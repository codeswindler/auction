import { db, dbDialect } from "./db";
import { auctions, campaigns, campaignNodes, users, transactions, ussdSessions, type Auction, type InsertAuction, type Campaign, type InsertCampaign, type CampaignNode, type InsertCampaignNode, type User, type InsertUser, type InsertTransaction, type USSDSession } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

export interface IStorage {
  getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(id: number, balance: string): Promise<User>;
  updateUserLoanLimit(id: number, limit: string): Promise<User>;
  setLoanStatus(id: number, hasActiveLoan: boolean): Promise<User>;
  createTransaction(transaction: InsertTransaction): Promise<number>;
  createFeeTransaction(userId: number, amount: string, reference: string, parentTransactionId: number, feeType?: string): Promise<number>;
  getTransactionById(id: number): Promise<any>;
  getFeeTransactions(parentTransactionId: number): Promise<any[]>;
  listAuctions(includeInactive?: boolean): Promise<Auction[]>;
  createAuction(auction: InsertAuction): Promise<Auction>;
  updateAuction(id: number, auction: Partial<InsertAuction>): Promise<Auction>;
  setAuctionActive(id: number, isActive: boolean): Promise<Auction>;
  listCampaigns(includeInactive?: boolean): Promise<Campaign[]>;
  getActiveCampaign(): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: number, campaign: Partial<InsertCampaign>): Promise<Campaign>;
  setActiveCampaign(id: number): Promise<Campaign>;
  listCampaignNodes(campaignId: number, includeInactive?: boolean): Promise<CampaignNode[]>;
  createCampaignNode(node: InsertCampaignNode): Promise<CampaignNode>;
  updateCampaignNode(id: number, node: Partial<InsertCampaignNode>): Promise<CampaignNode>;
  deleteCampaignNode(id: number): Promise<CampaignNode>;
  getOrCreateSession(sessionId: string, phoneNumber: string, ussdCode: string): Promise<USSDSession>;
  updateSession(sessionId: string, currentMenu: string, inputHistory: string): Promise<USSDSession>;
  getSession(sessionId: string): Promise<USSDSession | undefined>;
}

export class DatabaseStorage implements IStorage {
  private readonly isMySql = dbDialect === "mysql";

  async getUserByPhoneNumber(phoneNumber: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    if (this.isMySql) {
      const result = await (db as any).insert(users).values(insertUser).execute();
      const insertId = result?.insertId ?? result?.[0]?.insertId;
      const [user] = await db.select().from(users).where(eq(users.id, insertId));
      return user;
    }
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUserBalance(id: number, balance: string): Promise<User> {
    if (this.isMySql) {
      await (db as any).update(users).set({ balance }).where(eq(users.id, id)).execute();
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }
    const [user] = await db.update(users)
      .set({ balance })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async updateUserLoanLimit(id: number, limit: string): Promise<User> {
    if (this.isMySql) {
      await (db as any).update(users).set({ loanLimit: limit }).where(eq(users.id, id)).execute();
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }
    const [user] = await db.update(users)
      .set({ loanLimit: limit })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async setLoanStatus(id: number, hasActiveLoan: boolean): Promise<User> {
    if (this.isMySql) {
      await (db as any).update(users).set({ hasActiveLoan }).where(eq(users.id, id)).execute();
      const [user] = await db.select().from(users).where(eq(users.id, id));
      return user;
    }
    const [user] = await db.update(users)
      .set({ hasActiveLoan })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async createTransaction(transaction: InsertTransaction & { source?: string }): Promise<number> {
    if (this.isMySql) {
      const result = await (db as any).insert(transactions).values({
        ...transaction,
        source: transaction.source || 'ussd',
      } as any).execute();
      return result?.insertId ?? result?.[0]?.insertId;
    }
    const [result] = await db.insert(transactions).values({
      ...transaction,
      source: transaction.source || 'ussd',
    } as any).returning({ id: transactions.id });
    return result.id;
  }
  
  async createFeeTransaction(userId: number, amount: string, reference: string, parentTransactionId: number, feeType: string = 'fee', source: string = 'ussd'): Promise<number> {
    return this.createTransaction({
      userId,
      type: feeType,
      amount,
      reference,
      status: 'pending',
      parentTransactionId,
      isFee: true,
      source,
    } as any);
  }
  
  async getTransactionById(id: number) {
    const [transaction] = await db.select().from(transactions).where(eq(transactions.id, id));
    return transaction;
  }
  
  async getFeeTransactions(parentTransactionId: number) {
    const feeTransactions = await db.select().from(transactions).where(
      and(
        eq(transactions.parentTransactionId as any, parentTransactionId),
        eq(transactions.isFee as any, true)
      )
    );
    return feeTransactions;
  }

  async listAuctions(includeInactive: boolean = false): Promise<Auction[]> {
    if (includeInactive) {
      return db.select().from(auctions);
    }
    return db.select().from(auctions).where(eq(auctions.isActive as any, true));
  }

  async createAuction(auction: InsertAuction): Promise<Auction> {
    if (this.isMySql) {
      const result = await (db as any).insert(auctions).values(auction).execute();
      const insertId = result?.insertId ?? result?.[0]?.insertId;
      const [created] = await db.select().from(auctions).where(eq(auctions.id, insertId));
      return created;
    }
    const [created] = await db.insert(auctions).values(auction).returning();
    return created;
  }

  async updateAuction(id: number, auction: Partial<InsertAuction>): Promise<Auction> {
    if (this.isMySql) {
      await (db as any).update(auctions).set(auction).where(eq(auctions.id, id)).execute();
      const [updated] = await db.select().from(auctions).where(eq(auctions.id, id));
      return updated;
    }
    const [updated] = await db.update(auctions)
      .set(auction)
      .where(eq(auctions.id, id))
      .returning();
    return updated;
  }

  async setAuctionActive(id: number, isActive: boolean): Promise<Auction> {
    if (this.isMySql) {
      await (db as any).update(auctions).set({ isActive }).where(eq(auctions.id, id)).execute();
      const [updated] = await db.select().from(auctions).where(eq(auctions.id, id));
      return updated;
    }
    const [updated] = await db.update(auctions)
      .set({ isActive })
      .where(eq(auctions.id, id))
      .returning();
    return updated;
  }

  async listCampaigns(includeInactive: boolean = true): Promise<Campaign[]> {
    if (includeInactive) {
      return db.select().from(campaigns);
    }
    return db.select().from(campaigns).where(eq(campaigns.isActive as any, true));
  }

  async getActiveCampaign(): Promise<Campaign | undefined> {
    const [campaign] = await db.select().from(campaigns).where(eq(campaigns.isActive as any, true));
    return campaign;
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    if (this.isMySql) {
      const result = await (db as any).insert(campaigns).values(campaign).execute();
      const insertId = result?.insertId ?? result?.[0]?.insertId;
      const [created] = await db.select().from(campaigns).where(eq(campaigns.id, insertId));
      return created;
    }
    const [created] = await db.insert(campaigns).values(campaign).returning();
    return created;
  }

  async updateCampaign(id: number, campaign: Partial<InsertCampaign>): Promise<Campaign> {
    if (this.isMySql) {
      await (db as any).update(campaigns).set(campaign).where(eq(campaigns.id, id)).execute();
      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, id));
      return updated;
    }
    const [updated] = await db.update(campaigns)
      .set(campaign)
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async setActiveCampaign(id: number): Promise<Campaign> {
    if (this.isMySql) {
      await (db as any).update(campaigns).set({ isActive: false }).execute();
      await (db as any).update(campaigns).set({ isActive: true }).where(eq(campaigns.id, id)).execute();
      const [updated] = await db.select().from(campaigns).where(eq(campaigns.id, id));
      return updated;
    }
    await db.update(campaigns).set({ isActive: false });
    const [updated] = await db.update(campaigns)
      .set({ isActive: true })
      .where(eq(campaigns.id, id))
      .returning();
    return updated;
  }

  async listCampaignNodes(campaignId: number, includeInactive: boolean = true): Promise<CampaignNode[]> {
    if (includeInactive) {
      return db.select().from(campaignNodes).where(eq(campaignNodes.campaignId, campaignId)).orderBy(campaignNodes.sortOrder, campaignNodes.id);
    }
    return db.select().from(campaignNodes)
      .where(and(eq(campaignNodes.campaignId, campaignId), eq(campaignNodes.isActive as any, true)))
      .orderBy(campaignNodes.sortOrder, campaignNodes.id);
  }

  async createCampaignNode(node: InsertCampaignNode): Promise<CampaignNode> {
    if (this.isMySql) {
      const result = await (db as any).insert(campaignNodes).values(node).execute();
      const insertId = result?.insertId ?? result?.[0]?.insertId;
      const [created] = await db.select().from(campaignNodes).where(eq(campaignNodes.id, insertId));
      return created;
    }
    const [created] = await db.insert(campaignNodes).values(node).returning();
    return created;
  }

  async updateCampaignNode(id: number, node: Partial<InsertCampaignNode>): Promise<CampaignNode> {
    if (this.isMySql) {
      await (db as any).update(campaignNodes).set(node).where(eq(campaignNodes.id, id)).execute();
      const [updated] = await db.select().from(campaignNodes).where(eq(campaignNodes.id, id));
      return updated;
    }
    const [updated] = await db.update(campaignNodes)
      .set(node)
      .where(eq(campaignNodes.id, id))
      .returning();
    return updated;
  }

  async deleteCampaignNode(id: number): Promise<CampaignNode> {
    return this.updateCampaignNode(id, { isActive: false });
  }

  async getOrCreateSession(sessionId: string, phoneNumber: string, ussdCode: string): Promise<USSDSession> {
    const [existing] = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId));
    if (existing) return existing;

    if (this.isMySql) {
      await (db as any).insert(ussdSessions).values({
        sessionId,
        phoneNumber,
        ussdCode,
        inputHistory: "",
        currentMenu: "main",
      }).execute();
      const [session] = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId));
      return session;
    }

    const [session] = await db.insert(ussdSessions).values({
      sessionId,
      phoneNumber,
      ussdCode,
      inputHistory: "",
      currentMenu: "main",
    }).returning();
    return session;
  }

  async updateSession(sessionId: string, currentMenu: string, inputHistory: string): Promise<USSDSession> {
    if (this.isMySql) {
      await (db as any).update(ussdSessions)
        .set({ currentMenu, inputHistory, lastInteraction: sql`CURRENT_TIMESTAMP` })
        .where(eq(ussdSessions.sessionId, sessionId))
        .execute();
      const [session] = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId));
      return session;
    }
    const [session] = await db.update(ussdSessions)
      .set({ currentMenu, inputHistory, lastInteraction: new Date() })
      .where(eq(ussdSessions.sessionId, sessionId))
      .returning();
    return session;
  }

  async getSession(sessionId: string): Promise<USSDSession | undefined> {
    const [session] = await db.select().from(ussdSessions).where(eq(ussdSessions.sessionId, sessionId));
    return session;
  }
}

export const storage = new DatabaseStorage();
