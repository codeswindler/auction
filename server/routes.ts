import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { loginAdmin, logoutAdmin, isAdminLoggedIn, requireAdminAuth } from "./auth";
import { db } from "./db";
import { transactions as transactionsTable } from "@shared/schema";
import { eq, sql, and, or, isNull, inArray } from "drizzle-orm";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // Helper function to parse INPUT and extract the latest user selection
  function parseUSSDInput(input: string, ussdCode?: string): { parts: string[], lastInput: string } {
    // INPUT comes like "*123#" or "*123*1*2#" (simulator)
    // or "*519*65#" (gateway) or "*519*65*1*25000#"
    // Remove leading * and trailing #
    const cleaned = input.replace(/^\*/, "").replace(/#$/, "");
    const parts = cleaned.length ? cleaned.split("*") : [];
    const normalizedUssd = ussdCode ? ussdCode.replace(/^\*/, "").replace(/#$/, "") : "";

    let userParts: string[] = [];
    if (normalizedUssd && parts[0] === normalizedUssd) {
      userParts = parts.slice(1);
    } else if (parts.length > 2) {
      // Skip the gateway code prefix (legacy format)
      userParts = parts.slice(2);
    } else if (parts.length > 1) {
      // Simulator-style input: "*123*1#" -> ["123","1"]
      userParts = parts.slice(1);
    }

    const lastInput = userParts.length > 0 ? userParts[userParts.length - 1] : "";
    return { parts: userParts, lastInput };
  }

  // Helper function to generate a unique reference code
  function generateRef(): string {
    return Math.random().toString(36).substring(7).toUpperCase();
  }

  // Helper function to validate numeric input (for ID numbers and menu selections)
  function isValidNumeric(input: string): boolean {
    // Check if input contains only digits (0-9)
    return /^[0-9]+$/.test(input);
  }

  // USSD Session Logic Handler
  async function handleUSSDSession(msisdn: string, sessionId: string, ussdCode: string, input: string): Promise<string> {
    // Get or create session
    const session = await storage.getOrCreateSession(sessionId, msisdn, ussdCode);
    const { parts, lastInput } = parseUSSDInput(input, ussdCode);
    const level = parts.length;
    
    // Debug logging
    console.log(`[USSD DEBUG] Input: ${input}, Parts: [${parts.join(',')}], Level: ${level}, LastInput: ${lastInput}`);

    // Get or create user
    let user = await storage.getUserByPhoneNumber(msisdn);
    if (!user) {
      user = await storage.createUser({
        phoneNumber: msisdn,
        balance: "0",
        loanLimit: "25100",
        hasActiveLoan: false
      });
    }

    const activeCampaign = await storage.getActiveCampaign();
    if (!activeCampaign) {
      return "END No active campaign available. Please try again later.";
    }

    const allNodes = await storage.listCampaignNodes(activeCampaign.id, false);
    const nodesByParent = new Map<number | null, typeof allNodes>();
    allNodes.forEach((node) => {
      const parentId = node.parentId ?? null;
      if (!nodesByParent.has(parentId)) {
        nodesByParent.set(parentId, []);
      }
      nodesByParent.get(parentId)!.push(node);
    });

    const sortNodes = (nodes: typeof allNodes) =>
      nodes.sort((a, b) => {
        const orderA = a.sortOrder ?? 0;
        const orderB = b.sortOrder ?? 0;
        if (orderA === orderB) return a.id - b.id;
        return orderA - orderB;
      });

    const getChildren = (parentId: number | null) => sortNodes([...(nodesByParent.get(parentId) || [])]);

    let currentParentId: number | null = null;
    let currentNode = null as (typeof allNodes)[number] | null;

    for (const part of parts) {
      if (!isValidNumeric(part)) {
        const menu = buildMenu(currentNode?.prompt || activeCampaign.rootPrompt, getChildren(currentParentId));
        await storage.updateSession(sessionId, "campaign_menu_invalid", input);
        return `CON Invalid selection. Please try again.\n${menu}`;
      }

      const selection = parseInt(part, 10);
      const siblings = getChildren(currentParentId);
      if (selection < 1 || selection > siblings.length) {
        const menu = buildMenu(currentNode?.prompt || activeCampaign.rootPrompt, siblings);
        await storage.updateSession(sessionId, "campaign_menu_invalid", input);
        return `CON Invalid selection. Please try again.\n${menu}`;
      }

      currentNode = siblings[selection - 1];
      currentParentId = currentNode.id;
    }

    const children = getChildren(currentParentId);
    const prompt = currentNode?.prompt || activeCampaign.rootPrompt;

    if (children.length > 0) {
      const menu = buildMenu(prompt, children);
      await storage.updateSession(sessionId, `campaign_menu:${activeCampaign.id}:${currentParentId ?? "root"}`, input);
      return `CON ${menu}`;
    }

    if (currentNode?.actionType === "bid") {
      let payload: any = null;
      try {
        payload = currentNode.actionPayload ? JSON.parse(currentNode.actionPayload) : null;
      } catch {
        payload = null;
      }
      const bidAmount = Number(payload?.amount ?? 0);
      if (!Number.isFinite(bidAmount) || bidAmount <= 0) {
        return "END Invalid campaign configuration. Please try again later.";
      }

      const reference = generateRef();
      const minFee = Number(activeCampaign.bidFeeMin ?? 30);
      const maxFee = Number(activeCampaign.bidFeeMax ?? 99);
      const normalizedMin = Number.isFinite(minFee) ? minFee : 30;
      const normalizedMax = Number.isFinite(maxFee) ? maxFee : 99;
      const low = Math.max(0, Math.min(normalizedMin, normalizedMax));
      const high = Math.max(0, Math.max(normalizedMin, normalizedMax));
      const feeAmount = Math.floor(Math.random() * (high - low + 1)) + low;

      const bidTransactionId = await storage.createTransaction({
        userId: user.id,
        type: "bid",
        amount: bidAmount.toFixed(2),
        reference,
        status: "pending",
        parentTransactionId: null,
        isFee: false,
        source: "ussd",
      } as any);

      const feeReference = `${reference}-FEE`;
      const feeTransactionId = await storage.createFeeTransaction(
        user.id,
        feeAmount.toFixed(2),
        feeReference,
        bidTransactionId,
        "bid_fee",
        "ussd"
      );

      void triggerSTKPush(feeTransactionId, msisdn, feeAmount);
      await storage.updateSession(sessionId, "bid_payment", input);

      const bidFeePrompt = (activeCampaign.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.").trim();
      const message = bidFeePrompt.replace(/\{\{\s*ref\s*\}\}/gi, reference);
      return `END ${message}`;
    }

    return "END Thank you for using our service.";
  }

  function buildMenu(prompt: string, nodes: { label: string; actionType?: string | null; actionPayload?: string | null }[]): string {
    const menuLines = nodes.map((node, index) => {
      let line = `${index + 1}. ${node.label}`;
      if (node.actionType === "bid" && node.actionPayload) {
        try {
          const payload = JSON.parse(node.actionPayload);
          const amount = Number(payload?.amount ?? 0);
          if (Number.isFinite(amount) && amount > 0) {
            const formatted = amount.toLocaleString("en-US");
            line = `${line}-KES ${formatted}`;
          }
        } catch {
          // ignore payload errors for display
        }
      }
      return line;
    });
    return `${prompt}\n${menuLines.join("\n")}`.trim();
  }

  // Real Advanta USSD Gateway Endpoint
  // Supports both GET (Advanta default) and POST (if configured)
  app.get(api.ussd.handle.path, async (req, res) => {
    try {
      const { MSISDN, SESSIONID, USSDCODE, INPUT } = api.ussd.handle.input.parse(req.query);
      const response = await handleUSSDSession(MSISDN, SESSIONID, USSDCODE, INPUT);
      res.type('text/plain').send(response);
    } catch (error) {
      console.error(error);
      res.type('text/plain').send("END System error. Please try again later.");
    }
  });

  app.post(api.ussd.handle.path, async (req, res) => {
    try {
      // Support POST with query params or body params
      const params = { ...req.query, ...req.body };
      const { MSISDN, SESSIONID, USSDCODE, INPUT } = api.ussd.handle.input.parse(params);
      const response = await handleUSSDSession(MSISDN, SESSIONID, USSDCODE, INPUT);
      res.type('text/plain').send(response);
    } catch (error) {
      console.error(error);
      res.type('text/plain').send("END System error. Please try again later.");
    }
  });

  // Simulator endpoint for testing (POST JSON for easier frontend testing)
  // Protected: Requires admin authentication in production
  app.post(api.ussd.simulator.path, async (req, res) => {
    // Check authentication (disabled in development)
    if (process.env.NODE_ENV === "production" && process.env.APP_DEBUG !== "true") {
      const { isAdminLoggedIn } = await import("./auth");
      if (!isAdminLoggedIn(req)) {
        return res.status(401).json({ 
          error: "Unauthorized", 
          message: "Admin authentication required" 
        });
      }
    }
    try {
      const { phoneNumber, text, sessionId, ussdCode } = api.ussd.simulator.input.parse(req.body);
      const defaultUssdCode = process.env.SIMULATOR_USSD_CODE || "*123#";
      const response = await handleUSSDSession(phoneNumber, sessionId, ussdCode || defaultUssdCode, text);
      
      // Convert CON/END to JSON for simulator
      const isEnd = response.startsWith("END");
      const message = response.replace(/^(CON|END)\s/, "");
      
      res.json({
        message,
        type: isEnd ? "END" : "CON"
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "System error", type: "END" });
    }
  });

  app.get(api.users.get.path, async (req, res) => {
    const user = await storage.getUserByPhoneNumber(req.params.phoneNumber);
    if (!user) return res.json(null);
    res.json({
      phoneNumber: user.phoneNumber,
      balance: user.balance,
      loanLimit: user.loanLimit
    });
  });

  // Admin Endpoints
  app.get(api.admin.users.list.path, requireAdminAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { users: usersTable } = await import("@shared/schema");
      const allUsers = await db.select().from(usersTable);
      res.json(allUsers.map(u => ({
        id: u.id,
        phoneNumber: u.phoneNumber,
        idNumber: u.idNumber,
        balance: u.balance,
        loanLimit: u.loanLimit,
        hasActiveLoan: u.hasActiveLoan,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.get(api.admin.users.detail.path, requireAdminAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { users: usersTable } = await import("@shared/schema");
      const { eq } = await import("drizzle-orm");
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parseInt(req.params.id)));
      if (!user) return res.json(null);
      res.json({
        id: user.id,
        phoneNumber: user.phoneNumber,
        idNumber: user.idNumber,
        balance: user.balance,
        loanLimit: user.loanLimit,
        hasActiveLoan: user.hasActiveLoan,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching user" });
    }
  });

  app.get(api.admin.auctions.list.path, requireAdminAuth, async (req, res) => {
    try {
      const includeInactive = req.query.include_inactive === "true";
      const allAuctions = await storage.listAuctions(includeInactive);
      res.json(allAuctions.map((auction) => ({
        id: auction.id,
        title: auction.title,
        amount: auction.amount,
        isActive: auction.isActive ?? false,
        createdAt: auction.createdAt,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching auctions" });
    }
  });

  app.post(api.admin.auctions.create.path, requireAdminAuth, async (req, res) => {
    try {
      const payload = api.admin.auctions.create.input?.parse(req.body) ?? req.body;
      const created = await storage.createAuction({
        title: payload.title,
        amount: Number(payload.amount).toFixed(2),
        isActive: payload.isActive ?? true,
      });
      res.json({
        id: created.id,
        title: created.title,
        amount: created.amount,
        isActive: created.isActive ?? false,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error creating auction" });
    }
  });

  app.patch(api.admin.auctions.update.path, requireAdminAuth, async (req, res) => {
    try {
      const payload = api.admin.auctions.update.input?.parse(req.body) ?? req.body;
      const auctionId = parseInt(req.params.id);
      const updates: Record<string, any> = {};
      if (payload.title !== undefined) updates.title = payload.title;
      if (payload.amount !== undefined) updates.amount = Number(payload.amount).toFixed(2);
      if (payload.isActive !== undefined) updates.isActive = payload.isActive;

      const updated = await storage.updateAuction(auctionId, updates);
      res.json({
        id: updated.id,
        title: updated.title,
        amount: updated.amount,
        isActive: updated.isActive ?? false,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error updating auction" });
    }
  });

  app.get(api.admin.campaigns.list.path, requireAdminAuth, async (req, res) => {
    try {
      const includeInactive = req.query.include_inactive === "true";
      const campaigns = await storage.listCampaigns(includeInactive);
      res.json(campaigns.map((campaign) => ({
        id: campaign.id,
        name: campaign.name,
        menuTitle: campaign.menuTitle,
        rootPrompt: campaign.rootPrompt,
        bidFeeMin: campaign.bidFeeMin ?? "30",
        bidFeeMax: campaign.bidFeeMax ?? "99",
        bidFeePrompt: campaign.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.",
        isActive: campaign.isActive ?? false,
        createdAt: campaign.createdAt,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching campaigns" });
    }
  });

  app.post(api.admin.campaigns.create.path, requireAdminAuth, async (req, res) => {
    try {
      const payload = api.admin.campaigns.create.input?.parse(req.body) ?? req.body;
      const created = await storage.createCampaign({
        name: payload.name,
        menuTitle: payload.menuTitle,
        rootPrompt: payload.rootPrompt,
        bidFeeMin: payload.bidFeeMin,
        bidFeeMax: payload.bidFeeMax,
        bidFeePrompt: payload.bidFeePrompt,
        isActive: payload.isActive ?? false,
      });
      res.json({
        id: created.id,
        name: created.name,
        menuTitle: created.menuTitle,
        rootPrompt: created.rootPrompt,
        bidFeeMin: created.bidFeeMin ?? "30",
        bidFeeMax: created.bidFeeMax ?? "99",
        bidFeePrompt: created.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.",
        isActive: created.isActive ?? false,
        createdAt: created.createdAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error creating campaign" });
    }
  });

  app.patch(api.admin.campaigns.update.path, requireAdminAuth, async (req, res) => {
    try {
      const payload = api.admin.campaigns.update.input?.parse(req.body) ?? req.body;
      const campaignId = parseInt(req.params.id, 10);
      const updates: Record<string, any> = {};
      if (payload.name !== undefined) updates.name = payload.name;
      if (payload.menuTitle !== undefined) updates.menuTitle = payload.menuTitle;
      if (payload.rootPrompt !== undefined) updates.rootPrompt = payload.rootPrompt;
      if (payload.bidFeeMin !== undefined) updates.bidFeeMin = payload.bidFeeMin;
      if (payload.bidFeeMax !== undefined) updates.bidFeeMax = payload.bidFeeMax;
      if (payload.bidFeePrompt !== undefined) updates.bidFeePrompt = payload.bidFeePrompt;
      if (payload.isActive !== undefined) updates.isActive = payload.isActive;

      const updated = await storage.updateCampaign(campaignId, updates);
      res.json({
        id: updated.id,
        name: updated.name,
        menuTitle: updated.menuTitle,
        rootPrompt: updated.rootPrompt,
        bidFeeMin: updated.bidFeeMin ?? "30",
        bidFeeMax: updated.bidFeeMax ?? "99",
        bidFeePrompt: updated.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.",
        isActive: updated.isActive ?? false,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error updating campaign" });
    }
  });

  app.post(api.admin.campaigns.activate.path, requireAdminAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id, 10);
      const updated = await storage.setActiveCampaign(campaignId);
      res.json({
        id: updated.id,
        name: updated.name,
        menuTitle: updated.menuTitle,
        rootPrompt: updated.rootPrompt,
        bidFeeMin: updated.bidFeeMin ?? "30",
        bidFeeMax: updated.bidFeeMax ?? "99",
        bidFeePrompt: updated.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.",
        isActive: updated.isActive ?? false,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error activating campaign" });
    }
  });

  app.get(api.admin.campaigns.nodes.list.path, requireAdminAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id, 10);
      const includeInactive = req.query.include_inactive === "true";
      const nodes = await storage.listCampaignNodes(campaignId, includeInactive);
      res.json(nodes.map((node) => ({
        id: node.id,
        campaignId: node.campaignId,
        parentId: node.parentId ?? null,
        label: node.label,
        prompt: node.prompt ?? null,
        actionType: node.actionType ?? null,
        actionPayload: node.actionPayload ?? null,
        sortOrder: node.sortOrder ?? 0,
        isActive: node.isActive ?? false,
        createdAt: node.createdAt,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching campaign nodes" });
    }
  });

  app.post(api.admin.campaigns.nodes.create.path, requireAdminAuth, async (req, res) => {
    try {
      const campaignId = parseInt(req.params.id, 10);
      const payload = api.admin.campaigns.nodes.create.input?.parse(req.body) ?? req.body;
      const allNodes = await storage.listCampaignNodes(campaignId, true);
      const siblings = allNodes.filter((node) => (node.parentId ?? null) === (payload.parentId ?? null));
      const nextSortOrder = siblings.length > 0
        ? Math.max(...siblings.map((node) => node.sortOrder ?? 0)) + 1
        : 0;

      const created = await storage.createCampaignNode({
        campaignId,
        parentId: payload.parentId ?? null,
        label: payload.label,
        prompt: payload.prompt ?? null,
        actionType: payload.actionType ?? null,
        actionPayload: payload.actionPayload ?? null,
        sortOrder: payload.sortOrder ?? nextSortOrder,
        isActive: payload.isActive ?? true,
      });

      res.json({
        id: created.id,
        campaignId: created.campaignId,
        parentId: created.parentId ?? null,
        label: created.label,
        prompt: created.prompt ?? null,
        actionType: created.actionType ?? null,
        actionPayload: created.actionPayload ?? null,
        sortOrder: created.sortOrder ?? 0,
        isActive: created.isActive ?? false,
        createdAt: created.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      res.status(500).json({ message: "Error creating campaign node" });
    }
  });

  app.patch(api.admin.campaigns.nodes.update.path, requireAdminAuth, async (req, res) => {
    try {
      const payload = api.admin.campaigns.nodes.update.input?.parse(req.body) ?? req.body;
      const nodeId = parseInt(req.params.nodeId, 10);
      const updates: Record<string, any> = {};
      if (payload.parentId !== undefined) updates.parentId = payload.parentId;
      if (payload.label !== undefined) updates.label = payload.label;
      if (payload.prompt !== undefined) updates.prompt = payload.prompt;
      if (payload.actionType !== undefined) updates.actionType = payload.actionType;
      if (payload.actionPayload !== undefined) updates.actionPayload = payload.actionPayload;
      if (payload.sortOrder !== undefined) updates.sortOrder = payload.sortOrder;
      if (payload.isActive !== undefined) updates.isActive = payload.isActive;

      const updated = await storage.updateCampaignNode(nodeId, updates);
      res.json({
        id: updated.id,
        campaignId: updated.campaignId,
        parentId: updated.parentId ?? null,
        label: updated.label,
        prompt: updated.prompt ?? null,
        actionType: updated.actionType ?? null,
        actionPayload: updated.actionPayload ?? null,
        sortOrder: updated.sortOrder ?? 0,
        isActive: updated.isActive ?? false,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      res.status(500).json({ message: "Error updating campaign node" });
    }
  });

  app.delete(api.admin.campaigns.nodes.remove.path, requireAdminAuth, async (req, res) => {
    try {
      const nodeId = parseInt(req.params.nodeId, 10);
      const updated = await storage.deleteCampaignNode(nodeId);
      res.json({
        id: updated.id,
        campaignId: updated.campaignId,
        parentId: updated.parentId ?? null,
        label: updated.label,
        prompt: updated.prompt ?? null,
        actionType: updated.actionType ?? null,
        actionPayload: updated.actionPayload ?? null,
        sortOrder: updated.sortOrder ?? 0,
        isActive: updated.isActive ?? false,
        createdAt: updated.createdAt,
      });
    } catch (error) {
      const message = error instanceof Error ? error.stack || error.message : String(error);
      console.error(message);
      res.status(500).json({ message: "Error deleting campaign node" });
    }
  });

  // Admin Login Endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "Username and password required" });
    }
    if (loginAdmin(req, username, password)) {
      return res.json({ success: true, message: "Login successful" });
    }
    return res.status(401).json({ error: "Invalid credentials" });
  });

  // Admin Logout Endpoint
  app.post("/api/logout", async (req: Request, res: Response) => {
    logoutAdmin(req);
    res.json({ success: true, message: "Logged out" });
  });

  // Check Auth Status
  app.get("/api/auth/check", async (req: Request, res: Response) => {
    res.json({
      authenticated: isAdminLoggedIn(req),
      username: req.session?.adminUsername || null,
    });
  });

  app.get(api.admin.transactions.list.path, requireAdminAuth, async (req, res) => {
    try {
      const { db } = await import("./db");
      const { transactions: transactionsTable } = await import("@shared/schema");
      const { and, eq, or, gte, lte, sql, isNull } = await import("drizzle-orm");
      
      // Get filter parameters from query string
      const typeFilter = req.query.type as string | undefined;
      const statusFilter = req.query.status as string | undefined;
      const isFeeFilter = req.query.is_fee as string | undefined;
      const sourceFilter = req.query.source as string | undefined;
      const phoneNumberFilter = req.query.phone_number as string | undefined;
      const dateFrom = req.query.date_from as string | undefined;
      const dateTo = req.query.date_to as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      // Build conditions
      const conditions = [];
      
      // Filter by fee status
      if (isFeeFilter !== undefined && isFeeFilter !== null && isFeeFilter !== '') {
        if (isFeeFilter === 'true' || isFeeFilter === '1') {
          conditions.push(eq(transactionsTable.isFee as any, true));
        } else if (isFeeFilter === 'false' || isFeeFilter === '0') {
          conditions.push(
            or(
              eq(transactionsTable.isFee as any, false),
              isNull(transactionsTable.isFee as any)
            ) as any
          );
        }
      }
      
      // Filter by type
      if (typeFilter && typeFilter !== 'all') {
        conditions.push(eq(transactionsTable.type, typeFilter));
      }
      
      // Combined status filter - checks both transaction status and payment status
      if (statusFilter && statusFilter !== 'all') {
        if (statusFilter === 'paid') {
          conditions.push(
            sql`COALESCE(${(transactionsTable as any).paymentStatus}, ${transactionsTable.status}) = 'paid'` as any
          );
        } else if (statusFilter === 'failed') {
          conditions.push(
            sql`COALESCE(${(transactionsTable as any).paymentStatus}, ${transactionsTable.status}) = 'failed'` as any
          );
        } else {
          // For pending/completed, check both fields
          conditions.push(
            or(
              eq(transactionsTable.status, statusFilter),
              sql`COALESCE(${(transactionsTable as any).paymentStatus}, ${transactionsTable.status}) = ${statusFilter}` as any
            ) as any
          );
        }
      }
      
      // Date filters
      if (dateFrom) {
        conditions.push(sql`DATE(${transactionsTable.createdAt}) >= ${dateFrom}` as any);
      }
      
      if (dateTo) {
        conditions.push(sql`DATE(${transactionsTable.createdAt}) <= ${dateTo}` as any);
      }
      
      // Get phone numbers for filtering if phone number filter is provided
      let userIdsToFilter: number[] | null = null;
      if (phoneNumberFilter && phoneNumberFilter !== '') {
        const { users: usersTable } = await import("@shared/schema");
        // Format phone number
        let formattedPhone = phoneNumberFilter.replace(/[^0-9]/g, '');
        if (formattedPhone.startsWith('0')) {
          formattedPhone = '254' + formattedPhone.substring(1);
        }
        // Find users matching phone number using LIKE
        const matchingUsers = await db.select().from(usersTable).where(
          sql`${usersTable.phoneNumber}::text LIKE ${'%' + formattedPhone + '%'}` as any
        );
        userIdsToFilter = matchingUsers.map(u => u.id);
        if (userIdsToFilter.length > 0) {
          const { inArray } = await import("drizzle-orm");
          conditions.push(inArray(transactionsTable.userId, userIdsToFilter));
        } else {
          // No matching users, return empty result
          return res.json([]);
        }
      }
      
      let query = db.select().from(transactionsTable);
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
      
      query = query.orderBy(transactionsTable.createdAt) as any;
      
      if (limit && limit > 0) {
        query = query.limit(limit) as any;
      }
      
      const allTx = await query;
      
      // Get phone numbers for transactions (join with users)
      const { users: usersTable } = await import("@shared/schema");
      const usersMap = new Map<number, string>();
      if (allTx.length > 0) {
        const userIds = Array.from(new Set(allTx.map(t => t.userId)));
        if (userIds.length > 0) {
          const { inArray } = await import("drizzle-orm");
          const users = await db.select().from(usersTable).where(
            inArray(usersTable.id, userIds)
          );
          users.forEach(u => usersMap.set(u.id, u.phoneNumber));
        }
      }
      
      res.json(allTx.map(t => ({
        id: t.id,
        userId: t.userId,
        phoneNumber: usersMap.get(t.userId) || null, // Include phone number from users table
        type: t.type,
        amount: t.amount,
        reference: t.reference,
        status: t.status,
        paymentMethod: (t as any).paymentMethod || null,
        mpesaReceipt: (t as any).mpesaReceipt || null,
        mpesaTransactionId: (t as any).mpesaTransactionId || null,
        paymentPhone: (t as any).paymentPhone || null,
        paymentStatus: (t as any).paymentStatus || t.status,
        paymentDate: (t as any).paymentDate || null,
        isFee: (t as any).isFee || false,
        parentTransactionId: (t as any).parentTransactionId || null,
        source: (t as any).source || 'ussd', // 'ussd' or 'web'
        createdAt: t.createdAt,
      })));
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Error fetching transactions" });
    }
  });

  // Helper function to trigger STK push (non-blocking)
  async function triggerSTKPush(transactionId: number, phoneNumber: string, amount: number): Promise<void> {
    try {
      const protocol = process.env.NODE_ENV === "production" ? "https" : "http";
      const host = process.env.HOST || "localhost:5000";
      const stkPushUrl = `${protocol}://${host}/api/mpesa/stk-push`;
      
      await fetch(stkPushUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transactionId: transactionId.toString(),
          phoneNumber,
          amount: amount.toString(),
        }),
      });
    } catch (error) {
      console.error(`[STK PUSH ERROR] Failed to trigger STK push for transaction ${transactionId}:`, error);
    }
  }

  // M-Pesa STK Push Initiation Endpoint
  app.post("/api/mpesa/stk-push", async (req, res) => {
    try {
      const { transactionId, phoneNumber, amount } = req.body;

      if (!transactionId || !phoneNumber || !amount) {
        return res.status(400).json({ 
          error: "Missing required fields: transactionId, phoneNumber, amount" 
        });
      }

      // Get M-Pesa credentials from environment
      const consumerKey = process.env.MPESA_CONSUMER_KEY;
      const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
      const passkey = process.env.MPESA_PASSKEY;
      const shortcode = process.env.MPESA_SHORTCODE;
      const callbackUrl = process.env.MPESA_CALLBACK_URL || "https://jengacapital.co.ke/api/mpesa/callback";

      if (!consumerKey || !consumerSecret || !passkey || !shortcode) {
        return res.status(500).json({ 
          error: "M-Pesa credentials not configured" 
        });
      }

      // Get transaction details
      const transaction = await storage.getTransactionById(parseInt(transactionId));
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      // Format phone number (remove + and ensure it starts with 254)
      let formattedPhone = phoneNumber.replace(/[^0-9]/g, "");
      if (formattedPhone.startsWith("0")) {
        formattedPhone = "254" + formattedPhone.substring(1);
      }

      // Generate timestamp and password
      const timestamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0].replace("T", "");
      const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");

      // Get access token
      const accessTokenUrl = process.env.MPESA_ACCESS_TOKEN_URL || 
        "https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials";
      const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");

      const tokenResponse = await fetch(accessTokenUrl, {
        method: "GET",
        headers: {
          Authorization: `Basic ${credentials}`,
        },
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error("M-Pesa Access Token Error:", errorText);
        return res.status(500).json({ error: "Failed to get M-Pesa access token" });
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      if (!accessToken) {
        return res.status(500).json({ error: "Failed to get M-Pesa access token" });
      }

      // Initiate STK Push
      const stkPushUrl = process.env.MPESA_STK_PUSH_URL || 
        "https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest";

      const merchantRequestID = `JENGA-${Date.now()}-${transactionId}`;
      const checkoutRequestID = `CHECKOUT-${Date.now()}-${transactionId}`;

      const stkPushData = {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: "CustomerPayBillOnline",
        Amount: Math.ceil(parseFloat(amount)),
        PartyA: formattedPhone,
        PartyB: shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: callbackUrl,
        AccountReference: transaction.reference,
        TransactionDesc: `LiveAuction - ${transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}`,
        MerchantRequestID: merchantRequestID,
        CheckoutRequestID: checkoutRequestID,
      };

      const stkResponse = await fetch(stkPushUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(stkPushData),
      });

      const stkData = await stkResponse.json();

      if (stkResponse.ok && stkData.ResponseCode === "0") {
        // Success - store MerchantRequestID in transaction
        // Note: We need to add updateTransactionPayment method to storage
        // For now, we'll use a direct database update
        const { db } = await import("./db");
        const { transactions: transactionsTable } = await import("@shared/schema");
        const { eq } = await import("drizzle-orm");
        
        await db.update(transactionsTable)
          .set({ 
            // @ts-ignore - merchantRequestId may not be in schema yet
            merchantRequestId: merchantRequestID,
            // @ts-ignore
            mpesaTransactionId: merchantRequestID,
          })
          .where(eq(transactionsTable.id, parseInt(transactionId)));

        console.log(`STK Push initiated: Transaction ID ${transactionId}, MerchantRequestID: ${merchantRequestID}`);

        return res.json({
          success: true,
          message: "STK Push initiated successfully",
          merchantRequestID,
          checkoutRequestID,
          response: stkData,
        });
      } else {
        console.error("STK Push Error:", stkData);
        return res.status(500).json({
          error: "Failed to initiate STK Push",
          details: stkData,
        });
      }
    } catch (error: any) {
      console.error("STK Push Error:", error);
      return res.status(500).json({
        error: "Failed to initiate STK Push",
        message: error.message,
      });
    }
  });

  return httpServer;
}
