import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoginGate } from "@/components/LoginGate";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@shared/routes";
import { Users, ArrowLeft, Filter, X, Download, Search, DollarSign, Pencil, Power } from "lucide-react";
import { useLocation } from "wouter";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowUp, ArrowDown, Moon, Sun, Users as UsersIcon, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { GalaxyBackground } from "@/components/GalaxyBackground";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function Admin() {
  const [, navigate] = useLocation();
  
  // Debug: Log component mount
  useEffect(() => {
    console.log('[Admin] Component mounted');
    
    // Check for any errors
    const errorHandler = (e: ErrorEvent) => {
      console.error('[Admin] Global error:', e.error);
    };
    window.addEventListener('error', errorHandler);
    
    return () => {
      window.removeEventListener('error', errorHandler);
    };
  }, []);
  const [showFeesDialog, setShowFeesDialog] = useState(false);
  const [showAdminsDialog, setShowAdminsDialog] = useState(false);
  const [showAddAdminForm, setShowAddAdminForm] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    menuTitle: "",
    rootPrompt: "",
    bidFeeMin: "30",
    bidFeeMax: "99",
    bidFeePrompt: "Please complete the bid on MPesa, ref: {{ref}}.",
  });
  const [includeInactiveCampaigns, setIncludeInactiveCampaigns] = useState(true);
  const [includeInactiveNodes, setIncludeInactiveNodes] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [nodeForm, setNodeForm] = useState({
    parentId: null as number | null,
    label: "",
    prompt: "",
    actionType: "none",
    amount: "",
  });
  const [newAdminForm, setNewAdminForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    superAdminPassword: "",
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return document.documentElement.classList.contains("dark");
    }
    return false;
  });
  const queryClient = useQueryClient();
  
  // Filter state
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [feeFilter, setFeeFilter] = useState<string>("all"); // all, fees_only, exclude_fees
  const [sourceFilter, setSourceFilter] = useState<string>("all"); // all, ussd, web
  const [phoneNumberFilter, setPhoneNumberFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize] = useState<number>(100); // Limit to 100 transactions per page for performance

  // Build query string for filters
  const buildQueryString = () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (feeFilter === "fees_only") params.set("is_fee", "true");
    if (feeFilter === "exclude_fees") params.set("is_fee", "false");
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (phoneNumberFilter) params.set("phone_number", phoneNumberFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    // Add pagination limit - limit to 100 transactions per page for performance
    params.set("limit", String(pageSize));
    return params.toString();
  };

  const { data: campaigns = [], isLoading: campaignsLoading } = useQuery({
    queryKey: [api.admin.campaigns.list.path, includeInactiveCampaigns],
    queryFn: async () => {
      const response = await fetch(`${api.admin.campaigns.list.path}?include_inactive=${includeInactiveCampaigns ? "true" : "false"}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    staleTime: 30000,
  });

  const safeCampaigns = Array.isArray(campaigns) ? campaigns : [];
  const activeCampaign = safeCampaigns.find((campaign: any) => campaign && campaign.isActive) || null;
  const lastCampaign = safeCampaigns
    .slice()
    .sort((a: any, b: any) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    })[0] || null;
  const selectedCampaign = safeCampaigns.find((campaign: any) => campaign && campaign.id === selectedCampaignId) || null;

  useEffect(() => {
    if (safeCampaigns.length === 0) {
      if (selectedCampaignId !== null) {
        setSelectedCampaignId(null);
      }
      return;
    }
    const selectedExists = safeCampaigns.some((campaign: any) => campaign && campaign.id === selectedCampaignId);
    if (!selectedExists) {
      const nextId = activeCampaign?.id ?? safeCampaigns[0]?.id ?? null;
      if (nextId !== null) {
        setSelectedCampaignId(nextId);
      }
    }
  }, [safeCampaigns, activeCampaign?.id, selectedCampaignId]);

  const { data: campaignNodes = [], isLoading: nodesLoading } = useQuery({
    queryKey: [api.admin.campaigns.nodes.list.path, selectedCampaign?.id, includeInactiveNodes],
    queryFn: async () => {
      if (!selectedCampaign?.id) return [];
      const response = await fetch(
        api.admin.campaigns.nodes.list.path
          .replace(":id", String(selectedCampaign.id))
          + `?include_inactive=${includeInactiveNodes ? "true" : "false"}`
      );
      if (!response.ok) {
        throw new Error(`Failed to fetch campaign nodes: ${response.statusText}`);
      }
      const data = await response.json();
      return Array.isArray(data) ? data : [];
    },
    enabled: !!selectedCampaign?.id,
    staleTime: 30000,
  });

  // Fetch ALL transactions (unfiltered) for analytics - separate from filtered table data
  // This is used only for calculations, not rendering, so we can load all
  // If this fails, we'll fall back to using filtered transactions
  const { data: allTransactions = [], isLoading: allTxLoading, error: allTxError } = useQuery({
    queryKey: [api.admin.transactions.list.path, 'all'],
    queryFn: async () => {
      try {
        // Fetch without limit for analytics calculations
        // Add timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const response = await fetch(api.admin.transactions.list.path, {
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch all transactions: ${response.statusText}`);
        }
        const data = await response.json();
        const result = Array.isArray(data) ? data : [];
        console.log(`[Admin] Loaded ${result.length} total transactions for analytics`);
        return result;
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn('[Admin] All transactions query timed out, will use filtered transactions as fallback');
        } else {
          console.error('[Admin] Error fetching all transactions:', error);
        }
        // Return empty array - we'll use filtered transactions as fallback
        return [];
      }
    },
    staleTime: 60000, // Cache for 60 seconds (analytics don't need to update as frequently)
    gcTime: 600000, // Keep in cache for 10 minutes
    // Only refetch in background, don't block UI
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1, // Only retry once
  });


  const { data: admins = [], isLoading: adminsLoading, error: adminsError } = useQuery({
    queryKey: ["/api/admin/admins"],
    queryFn: async () => {
      try {
        const response = await fetch("/api/admin/admins");
        if (!response.ok) {
          console.error('[Admin] Failed to fetch admins:', response.status, response.statusText);
          return []; // Return empty array on error
        }
        const data = await response.json();
        // Ensure we always return an array
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error('[Admin] Error fetching admins:', error);
        return []; // Return empty array on error
      }
    },
  });

  const { data: superAdminCheck = { isSuperAdmin: false } } = useQuery({
    queryKey: ["/api/admin/check-super-admin"],
    queryFn: () => fetch("/api/admin/check-super-admin").then(r => r.json()),
  });

  const isSuperAdmin = superAdminCheck.isSuperAdmin === true;

  const createAdminMutation = useMutation({
    mutationFn: async (data: { username: string; password: string; superAdminPassword: string }) => {
      const response = await fetch("/api/admin/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create admin");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      // Force refetch to show new admin immediately
      queryClient.refetchQueries({ queryKey: ["/api/admin/admins"] });
    },
  });

  const createCampaignMutation = useMutation({
    mutationFn: async (data: { name: string; menuTitle: string; rootPrompt: string; bidFeeMin: number; bidFeeMax: number; bidFeePrompt: string; isActive?: boolean }) => {
      const response = await fetch(api.admin.campaigns.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.list.path] });
    },
  });

  const updateCampaignMutation = useMutation({
    mutationFn: async (data: { id: number; name?: string; menuTitle?: string; rootPrompt?: string; bidFeeMin?: number; bidFeeMax?: number; bidFeePrompt?: string; isActive?: boolean }) => {
      const response = await fetch(`${api.admin.campaigns.update.path.replace(":id", String(data.id))}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          menuTitle: data.menuTitle,
          rootPrompt: data.rootPrompt,
          bidFeeMin: data.bidFeeMin,
          bidFeeMax: data.bidFeeMax,
          bidFeePrompt: data.bidFeePrompt,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.list.path] });
    },
  });

  const activateCampaignMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`${api.admin.campaigns.activate.path.replace(":id", String(id))}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to activate campaign");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.nodes.list.path] });
    },
  });

  const createNodeMutation = useMutation({
    mutationFn: async (data: { campaignId: number; parentId: number | null; label: string; prompt?: string | null; actionType?: string | null; actionPayload?: string | null; sortOrder?: number; isActive?: boolean }) => {
      const response = await fetch(`${api.admin.campaigns.nodes.create.path.replace(":id", String(data.campaignId))}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentId: data.parentId,
          label: data.label,
          prompt: data.prompt,
          actionType: data.actionType,
          actionPayload: data.actionPayload,
          sortOrder: data.sortOrder,
          isActive: data.isActive,
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create node");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.nodes.list.path] });
    },
  });

  const updateNodeMutation = useMutation({
    mutationFn: async (data: { campaignId: number; id: number; parentId?: number | null; label?: string; prompt?: string | null; actionType?: string | null; actionPayload?: string | null; sortOrder?: number; isActive?: boolean }) => {
      const response = await fetch(
        api.admin.campaigns.nodes.update.path
          .replace(":id", String(data.campaignId))
          .replace(":nodeId", String(data.id)),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            parentId: data.parentId,
            label: data.label,
            prompt: data.prompt,
            actionType: data.actionType,
            actionPayload: data.actionPayload,
            sortOrder: data.sortOrder,
            isActive: data.isActive,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update node");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.nodes.list.path] });
    },
  });

  const deleteNodeMutation = useMutation({
    mutationFn: async (data: { campaignId: number; id: number }) => {
      const response = await fetch(
        api.admin.campaigns.nodes.remove.path
          .replace(":id", String(data.campaignId))
          .replace(":nodeId", String(data.id)),
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete node");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.admin.campaigns.nodes.list.path] });
    },
  });

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  const resetCampaignForm = () => {
    setEditingCampaign(null);
    setCampaignForm({
      name: "",
      menuTitle: "",
      rootPrompt: "",
      bidFeeMin: "30",
      bidFeeMax: "99",
      bidFeePrompt: "Please complete the bid on MPesa, ref: {{ref}}.",
    });
  };

  const handleCampaignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = campaignForm.name.trim();
    const menuTitle = campaignForm.menuTitle.trim();
    const rootPrompt = campaignForm.rootPrompt.trim();
    const bidFeePrompt = campaignForm.bidFeePrompt.trim();
    const bidFeeMin = Number(campaignForm.bidFeeMin);
    const bidFeeMax = Number(campaignForm.bidFeeMax);
    if (!name || !menuTitle || !rootPrompt) {
      alert("Name, menu title, and root prompt are required.");
      return;
    }
    if (!Number.isFinite(bidFeeMin) || bidFeeMin < 0) {
      alert("Bid fee minimum must be a valid number (0 or more).");
      return;
    }
    if (!Number.isFinite(bidFeeMax) || bidFeeMax < 0) {
      alert("Bid fee maximum must be a valid number (0 or more).");
      return;
    }
    if (bidFeeMin > bidFeeMax) {
      alert("Bid fee minimum cannot be greater than maximum.");
      return;
    }
    if (!bidFeePrompt) {
      alert("Bid fee prompt message is required.");
      return;
    }

    try {
      if (editingCampaign) {
        await updateCampaignMutation.mutateAsync({
          id: editingCampaign.id,
          name,
          menuTitle,
          rootPrompt,
          bidFeeMin,
          bidFeeMax,
          bidFeePrompt,
        });
      } else {
        await createCampaignMutation.mutateAsync({
          name,
          menuTitle,
          rootPrompt,
          bidFeeMin,
          bidFeeMax,
          bidFeePrompt,
          isActive: false,
        });
      }
      resetCampaignForm();
    } catch (error: any) {
      alert(error.message || "Failed to save campaign");
    }
  };

  const resetNodeForm = (parentId: number | null = null) => {
    setEditingNode(null);
    setNodeForm({
      parentId,
      label: "",
      prompt: "",
      actionType: "none",
      amount: "",
    });
  };

  const handleNodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCampaign?.id) {
      alert("No campaign selected.");
      return;
    }
    const label = nodeForm.label.trim();
    if (!label) {
      alert("Node label is required.");
      return;
    }
    let actionPayload = "";
    if (nodeForm.actionType === "bid") {
      const amount = Number(nodeForm.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        alert("Enter a valid amount for bid nodes.");
        return;
      }
      actionPayload = JSON.stringify({ amount });
    }

    try {
      const normalizedActionType = nodeForm.actionType === "none" ? undefined : nodeForm.actionType;
      const normalizedPayload = nodeForm.actionType === "none" ? undefined : (actionPayload || undefined);
      const normalizedPrompt = nodeForm.prompt.trim() === "" ? undefined : nodeForm.prompt.trim();
      if (editingNode) {
        await updateNodeMutation.mutateAsync({
          campaignId: selectedCampaign.id,
          id: editingNode.id,
          parentId: nodeForm.parentId,
          label,
          prompt: normalizedPrompt,
          actionType: normalizedActionType,
          actionPayload: normalizedPayload,
        });
      } else {
        await createNodeMutation.mutateAsync({
          campaignId: selectedCampaign.id,
          parentId: nodeForm.parentId,
          label,
          prompt: normalizedPrompt,
          actionType: normalizedActionType,
          actionPayload: normalizedPayload,
          isActive: true,
        });
      }
      resetNodeForm(nodeForm.parentId);
    } catch (error: any) {
      alert(error.message || "Failed to save node");
    }
  };

  // Load theme from localStorage on mount
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "dark") {
      setIsDarkMode(true);
      document.documentElement.classList.add("dark");
    } else {
      setIsDarkMode(false);
      document.documentElement.classList.remove("dark");
    }
  }, []);

  // Fetch filtered transactions for table display (with pagination limit)
  const { data: transactions = [], isLoading: txLoading, error: txError } = useQuery({
    queryKey: [api.admin.transactions.list.path, typeFilter, statusFilter, feeFilter, sourceFilter, phoneNumberFilter, dateFrom, dateTo, page],
    queryFn: async () => {
      try {
      const queryString = buildQueryString();
      const transactionsUrl = `${api.admin.transactions.list.path}${queryString ? `?${queryString}` : ""}`;
      const response = await fetch(transactionsUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch transactions: ${response.statusText}`);
      }
      const data = await response.json();
      // Ensure we always return an array
        const result = Array.isArray(data) ? data : [];
        // Limit to first 100 for performance (pagination will be added later)
        const limited = result.slice(0, pageSize);
        if (limited.length > 0) {
          console.log(`[Admin] Loaded ${limited.length} of ${result.length} filtered transactions (showing first ${pageSize})`);
        }
        return limited;
      } catch (error) {
        console.error('[Admin] Error fetching transactions:', error);
        return [];
      }
    },
    staleTime: 30000, // Cache for 30 seconds to reduce refetches
    gcTime: 300000, // Keep in cache for 5 minutes
  });

  // Ensure transactions are arrays
  const safeTransactions = Array.isArray(transactions) ? transactions : [];
  const safeAllTransactions = Array.isArray(allTransactions) ? allTransactions : []; // All transactions for analytics

  // Fetch full filtered transactions for export/count (no client-side limiting)
  const { data: exportTransactions = [], isLoading: exportLoading } = useQuery({
    queryKey: [api.admin.transactions.list.path, "export", typeFilter, statusFilter, feeFilter, sourceFilter, phoneNumberFilter, dateFrom, dateTo],
    queryFn: async () => {
      try {
        const queryString = buildQueryString();
        const transactionsUrl = `${api.admin.transactions.list.path}${queryString ? `?${queryString}` : ""}`;
        const response = await fetch(transactionsUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch transactions: ${response.statusText}`);
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
      } catch (error) {
        console.error("[Admin] Error fetching export transactions:", error);
        return [];
      }
    },
    staleTime: 30000,
    gcTime: 300000,
  });

  const exportCount = Array.isArray(exportTransactions) ? exportTransactions.length : 0;

  // Helper function to get display name for a transaction
  // For old data without paymentName, show blank instead of trying to derive it
  const getDisplayName = (tx: any) => {
    try {
      // If paymentName exists (from M-Pesa), use it
      if (tx?.paymentName && tx.paymentName.trim() !== '') {
        return tx.paymentName;
      }
      // For old data without paymentName, show blank/N/A
      return 'N/A';
    } catch (error) {
      console.error('Error getting display name:', error);
      return 'N/A';
    }
  };

  const totalTransactions = safeAllTransactions.length;
  const fallbackCampaign = safeCampaigns
    .slice()
    .sort((a: any, b: any) => {
      const dateA = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (dateA === dateB) return (b?.id || 0) - (a?.id || 0);
      return dateB - dateA;
    })[0] || null;
  const safeCampaignNodes = Array.isArray(campaignNodes) ? campaignNodes : [];
  const nodesByParent = safeCampaignNodes.reduce((acc: Record<string, any[]>, node: any) => {
    const parentKey = node.parentId ?? "root";
    if (!acc[parentKey]) acc[parentKey] = [];
    acc[parentKey].push(node);
    return acc;
  }, {});

  const sortNodes = (nodes: any[]) =>
    nodes.slice().sort((a, b) => {
      const orderA = a.sortOrder ?? 0;
      const orderB = b.sortOrder ?? 0;
      if (orderA === orderB) return a.id - b.id;
      return orderA - orderB;
    });

  const getNodeAmount = (node: any) => {
    if (!node?.actionPayload) return "";
    try {
      const payload = JSON.parse(node.actionPayload);
      return payload?.amount ? String(payload.amount) : "";
    } catch {
      return "";
    }
  };

  const startEditNode = (node: any) => {
    setEditingNode(node);
    setNodeForm({
      parentId: node.parentId ?? null,
      label: node.label || "",
      prompt: node.prompt || "",
      actionType: node.actionType || "none",
      amount: getNodeAmount(node),
    });
  };

  const renderNodes = (parentId: number | null, depth: number = 0) => {
    const key = parentId ?? "root";
    const nodes = sortNodes(nodesByParent[key] || []);
    if (nodes.length === 0) return null;

    return nodes.map((node: any) => (
      <div key={node.id} className="border-b border-border/50 py-2">
        <div className="flex items-center justify-between" style={{ paddingLeft: depth * 16 }}>
          <div>
            <p className="text-sm font-medium text-foreground">
              {node.label}
              {node.actionType === "bid" && node.actionPayload && (
                <span className="text-xs text-muted-foreground ml-2">
                  KES {Number(getNodeAmount(node) || 0).toLocaleString()}
                </span>
              )}
            </p>
            {node.prompt && (
              <p className="text-xs text-muted-foreground mt-1">{node.prompt}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => resetNodeForm(node.id)}
            >
              Add Child
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => startEditNode(node)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                if (!selectedCampaign?.id) return;
                deleteNodeMutation.mutate({ campaignId: selectedCampaign.id, id: node.id });
              }}
              className="text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
        {renderNodes(node.id, depth + 1)}
      </div>
    ));
  };

  // Helper function to get date in Nairobi timezone
  const getNairobiDate = (date: Date): Date => {
    const nairobiStr = date.toLocaleString("en-US", { timeZone: "Africa/Nairobi" });
    return new Date(nairobiStr);
  };

  // Calculate fee totals for different time periods (using Nairobi timezone)
  const now = new Date();
  const nairobiNow = getNairobiDate(now);
  
  // Calculate start of today in Nairobi timezone
  const startOfToday = new Date(nairobiNow);
  startOfToday.setHours(0, 0, 0, 0);
  
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);
  
  // Start of week (Sunday) in Nairobi timezone
  const startOfWeek = new Date(startOfToday);
  const dayOfWeek = startOfToday.getDay(); // 0 = Sunday, 1 = Monday, etc.
  startOfWeek.setDate(startOfToday.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);
  
  const startOfLastWeek = new Date(startOfWeek);
  startOfLastWeek.setDate(startOfWeek.getDate() - 7);

  // All paid fees - use ALL transactions for analytics
  const paidFees = safeAllTransactions.filter((tx: any) => 
    tx && tx.isFee && (tx.paymentStatus === 'paid' || tx.status === 'completed')
  );

  // Helper function to safely parse transaction date
  const getTransactionDate = (tx: any): Date | null => {
    const dateStr = tx.createdAt || tx.paymentDate || tx.created_at;
    if (!dateStr) return null;
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? null : date;
  };

  // Fees for today
  const feesToday = paidFees.filter((tx: any) => {
    if (!tx) return false;
    const txDate = getTransactionDate(tx);
    if (!txDate) return false;
    return txDate >= startOfToday;
  });
  const totalFeesToday = feesToday.reduce((sum: number, tx: any) => {
    try {
      return sum + parseFloat(tx?.amount || 0);
    } catch {
      return sum;
    }
  }, 0);

  // Fees for yesterday (for comparison)
  const feesYesterday = paidFees.filter((tx: any) => {
    if (!tx) return false;
    const txDate = getTransactionDate(tx);
    if (!txDate) return false;
    return txDate >= startOfYesterday && txDate < startOfToday;
  });
  const totalFeesYesterday = feesYesterday.reduce((sum: number, tx: any) => {
    try {
      return sum + parseFloat(tx?.amount || 0);
    } catch {
      return sum;
    }
  }, 0);

  // Fees for this week
  const feesThisWeek = paidFees.filter((tx: any) => {
    if (!tx) return false;
    const txDate = getTransactionDate(tx);
    if (!txDate) return false;
    return txDate >= startOfWeek;
  });
  const totalFeesThisWeek = feesThisWeek.reduce((sum: number, tx: any) => {
    try {
      return sum + parseFloat(tx?.amount || 0);
    } catch {
      return sum;
    }
  }, 0);

  // Fees for last week (for comparison)
  const feesLastWeek = paidFees.filter((tx: any) => {
    if (!tx) return false;
    const txDate = getTransactionDate(tx);
    if (!txDate) return false;
    return txDate >= startOfLastWeek && txDate < startOfWeek;
  });
  const totalFeesLastWeek = feesLastWeek.reduce((sum: number, tx: any) => {
    try {
      return sum + parseFloat(tx?.amount || 0);
    } catch {
      return sum;
    }
  }, 0);

  // All time fees
  const totalFeesPaid = paidFees.reduce((sum: number, tx: any) => {
    try {
      return sum + parseFloat(tx?.amount || 0);
    } catch {
      return sum;
    }
  }, 0);

  // Calculate percentage change for today vs yesterday
  const todayPercentageChange = totalFeesYesterday > 0 
    ? ((totalFeesToday - totalFeesYesterday) / totalFeesYesterday) * 100 
    : (totalFeesToday > 0 ? 100 : 0);

  // Calculate percentage change for week
  const weekPercentageChange = totalFeesLastWeek > 0 
    ? ((totalFeesThisWeek - totalFeesLastWeek) / totalFeesLastWeek) * 100 
    : (totalFeesThisWeek > 0 ? 100 : 0);

  // Helper function to calculate breakdown for a set of fees
  const calculateBreakdown = (fees: any[]) => {
    const bidFees = fees.filter((tx: any) =>
      tx && (tx.type === 'bid_fee' || tx.type === 'fee')
    );
    const totalBidFees = bidFees.reduce((sum: number, tx: any) => {
      try {
        return sum + parseFloat(tx?.amount || 0);
      } catch {
        return sum;
      }
    }, 0);
    return { bidFees, totalBidFees };
  };

  const breakdownToday = calculateBreakdown(feesToday);
  const breakdownThisWeek = calculateBreakdown(feesThisWeek);
  const breakdownAllTime = calculateBreakdown(paidFees);

  const clearFilters = () => {
    setTypeFilter("all");
    setStatusFilter("all");
    setFeeFilter("all");
    setSourceFilter("all");
    setPhoneNumberFilter("");
    setDateFrom("");
    setDateTo("");
  };

  const hasActiveFilters = typeFilter !== "all" || statusFilter !== "all" || feeFilter !== "all" || sourceFilter !== "all" || phoneNumberFilter || dateFrom || dateTo;

  // Export to Excel function
  const exportToExcel = () => {
    if (exportCount === 0) {
      alert("No transactions to export");
      return;
    }

    // Prepare data for Excel
    const excelData = exportTransactions.map((tx: any) => {
      if (!tx) return null;
      return {
      "ID": tx.id,
      "Phone Number": tx.phoneNumber || "-",
      "Type": tx.type,
      "Amount (KES)": parseFloat(tx.amount || 0).toLocaleString(),
      "Reference": tx.reference,
      "Source": tx.source === 'web' ? 'Web App' : 'USSD',
      "Status": tx.paymentStatus === 'paid' ? 'Paid' : 
                tx.paymentStatus === 'failed' ? 'Failed' :
                tx.status === 'completed' ? 'Completed' : 'Pending',
      "M-Pesa Receipt": tx.mpesaReceipt || "-",
      "Failure Reason": tx.paymentFailureReason || "-",
      "Payment Date": tx.paymentDate ? new Date(tx.paymentDate).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "-",
      "Is Fee": tx.isFee ? "Yes" : "No",
      "Created At": tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-KE", { timeZone: "Africa/Nairobi" }) : "-",
      };
    }).filter((item: any) => item !== null);

    // Create workbook and worksheet
    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transactions");

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `jenga-capital-transactions-${dateStr}.xlsx`;

    // Write file
    XLSX.writeFile(wb, filename);
  };

  const [newAdminUsername, setNewAdminUsername] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminUsername || !newAdminPassword) {
      alert("Username and password are required");
      return;
    }
    if (newAdminPassword.length < 8) {
      alert("Password must be at least 8 characters");
      return;
    }
    // Ask for super admin password as final step
    const superAdminPassword = prompt("Enter your admin password to confirm creation:");
    if (!superAdminPassword) {
      return;
    }
    
    try {
      await createAdminMutation.mutateAsync({
        username: newAdminUsername,
        password: newAdminPassword,
        superAdminPassword,
      });
      setNewAdminUsername("");
      setNewAdminPassword("");
      alert("Admin user created successfully!");
    } catch (error: any) {
      alert(error.message || "Failed to create admin user");
    }
  };

  return (
    <LoginGate>
        <div className="min-h-screen bg-background relative overflow-hidden">
          {isDarkMode && <GalaxyBackground />}
        {/* Header */}
          <header className="w-full py-6 px-6 md:px-12 border-b border-border bg-card/80 backdrop-blur-xl sticky top-0 z-10">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">Admin Dashboard</h1>
                <p className="text-xs text-muted-foreground font-medium">LiveAuction</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={toggleDarkMode}
                className="gap-2"
              >
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/simulator")}
              >
                Go to USSD Simulator
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAdminsDialog(true)}
                className="gap-2"
              >
                <UsersIcon className="w-4 h-4" />
                Admins
              </Button>
            <Button 
              variant="ghost" 
              size="sm"
              className="gap-2"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Menu
            </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto p-6 md:p-12">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {allTxLoading ? '...' : totalTransactions}
                  </p>
                </div>
                <Users className="w-8 h-8 text-primary/50" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Fees Paid Today</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {allTxLoading ? '...' : `KES ${totalFeesToday.toLocaleString()}`}
                  </p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-500/50" />
              </div>
            </Card>

            <Card 
              className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => setShowFeesDialog(true)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Fees Paid</p>
                  <p className="text-3xl font-bold text-foreground mt-2">
                    {allTxLoading ? '...' : `KES ${totalFeesPaid.toLocaleString()}`}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Click to view breakdown</p>
                </div>
                <DollarSign className="w-8 h-8 text-emerald-500/50" />
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Campaign</p>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {campaignsLoading ? "..." : (activeCampaign?.name || fallbackCampaign?.name || "None")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {activeCampaign ? "Active" : (fallbackCampaign ? "Inactive" : "No campaigns")}
                  </p>
                </div>
                <Users className="w-8 h-8 text-primary/50" />
              </div>
            </Card>
          </div>

          {/* Transactions Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-foreground">Transactions</h2>
              <div className="flex items-center gap-2">
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                  disabled={exportLoading}
                  onClick={exportToExcel}
                >
                  {exportLoading ? "Loading..." : `Current Report: ${exportCount}`}
                </Button>
              )}
              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="gap-2">
                  <X className="w-4 h-4" />
                  Clear Filters
                </Button>
              )}
                <Button variant="default" size="sm" onClick={exportToExcel} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export Current
                </Button>
              </div>
            </div>

            {/* Filters */}
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <button
                  type="button"
                  onClick={hasActiveFilters ? clearFilters : undefined}
                  className={hasActiveFilters ? "cursor-pointer" : "cursor-default"}
                  aria-label="Clear filters"
                  title={hasActiveFilters ? "Clear filters" : "Filters"}
                >
                  <Filter className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-sm font-medium text-foreground">Filters</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Phone Number</label>
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      type="text"
                      placeholder="254712345678"
                      value={phoneNumberFilter}
                      onChange={(e) => setPhoneNumberFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>
              </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Type</label>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="bid">Bid</SelectItem>
                      <SelectItem value="bid_fee">Bid Fee</SelectItem>
                      <SelectItem value="fee">Fee</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Status</label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Fee Filter</label>
                  <Select value={feeFilter} onValueChange={setFeeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All transactions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Transactions</SelectItem>
                      <SelectItem value="fees_only">Fees Only</SelectItem>
                      <SelectItem value="exclude_fees">Exclude Fees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Source</label>
                  <Select value={sourceFilter} onValueChange={setSourceFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All sources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Sources</SelectItem>
                      <SelectItem value="ussd">USSD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Date From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Date To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>
            </Card>

            {txLoading ? (
              <Card className="p-6"><p className="text-muted-foreground">Loading...</p></Card>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Type</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Phone Number</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                        <th className="text-right py-3 px-4 font-semibold text-foreground">Amount</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Reference</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Source</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">M-Pesa Receipt</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">Status</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txError ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-red-500">
                          Error loading transactions. Please refresh the page.
                        </td>
                      </tr>
                    ) : txLoading ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
                          Loading transactions...
                        </td>
                      </tr>
                    ) : !Array.isArray(safeTransactions) || safeTransactions.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-8 text-center text-muted-foreground">
                          No transactions found {hasActiveFilters ? '(try clearing filters)' : ''}
                        </td>
                      </tr>
                    ) : (
                      <>
                        {safeTransactions.slice(0, pageSize).map((tx: any) => {
                          if (!tx) return null;
                          return (
                            <tr key={tx.id} className={`border-b border-border/50 hover:bg-muted/30 ${tx.isFee ? 'bg-blue-50/30' : ''}`}>
                              <td className="py-3 px-4 text-sm font-medium capitalize text-foreground">
                            {tx.isFee && <span className="text-xs text-blue-600 mr-1">[FEE]</span>}
                            {tx.type === 'bid' && '🛒 Bid'}
                            {tx.type === 'bid_fee' && '💳 Bid Fee'}
                            {tx.type === 'fee' && '💳 Fee'}
                          </td>
                              <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{tx.phoneNumber || "-"}</td>
                              <td className="py-3 px-4 text-sm text-foreground">
                                {getDisplayName(tx)}
                              </td>
                              <td className="py-3 px-4 text-sm text-right font-medium text-foreground">KES {parseFloat(tx.amount || 0).toLocaleString()}</td>
                              <td className="py-3 px-4 text-sm font-mono text-muted-foreground">{tx.reference}</td>
                              <td className="py-3 px-4 text-center">
                                <Badge 
                                  variant={tx.source === 'web' ? 'default' : 'secondary'}
                                  className={tx.source === 'web' ? 'bg-primary text-primary-foreground' : ''}
                                >
                                  {tx.source === 'web' ? '🌐 Web' : '📱 USSD'}
                                </Badge>
                              </td>
                              <td className="py-3 px-4 text-sm font-mono text-muted-foreground">
                            {tx.mpesaReceipt || <span className="text-muted-foreground">-</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge 
                              variant={
                                tx.paymentStatus === 'paid' || tx.status === 'completed' ? 'default' : 
                                tx.paymentStatus === 'failed' ? 'destructive' : 
                                'secondary'
                              }
                            >
                              {tx.paymentStatus === 'paid' ? 'Paid' : 
                               tx.paymentStatus === 'failed' ? 'Failed' :
                               tx.status === 'completed' ? 'Completed' :
                               'Pending'}
                            </Badge>
                          </td>
                              <td className="py-3 px-4 text-sm text-muted-foreground">
                                {tx.createdAt ? new Date(tx.createdAt).toLocaleString("en-KE", { 
                                  timeZone: "Africa/Nairobi",
                                  year: "numeric",
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit"
                                }) : "-"}
                              </td>
                            </tr>
                          );
                        })}
                        {safeTransactions.length > pageSize && (
                          <tr>
                            <td colSpan={9} className="py-4 text-center text-muted-foreground text-sm">
                              Showing first {pageSize} of {safeTransactions.length} transactions. Use filters to narrow results.
                          </td>
                        </tr>
                        )}
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>

        {/* Campaigns Dialog */}

        {/* Fees Breakdown Dialog */}
        <Dialog open={showFeesDialog} onOpenChange={setShowFeesDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Fees Breakdown & Analytics</DialogTitle>
              {allTxError && (
                <p className="text-xs text-yellow-600 mt-1">
                  ⚠️ Using available data for analytics
                </p>
              )}
            </DialogHeader>
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="today">Today</TabsTrigger>
                <TabsTrigger value="week">This Week</TabsTrigger>
                <TabsTrigger value="all">All Time</TabsTrigger>
                <TabsTrigger value="live">Live Data</TabsTrigger>
              </TabsList>

              {/* Today Tab */}
              <TabsContent value="today" className="space-y-4 mt-4">
                <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fees Paid Today</p>
                      <p className="text-3xl font-bold text-foreground mt-2">KES {totalFeesToday.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {todayPercentageChange !== 0 && (
                          <div className={`flex items-center gap-1 text-sm font-semibold ${
                            todayPercentageChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {todayPercentageChange > 0 ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )}
                            <span>{Math.abs(todayPercentageChange).toFixed(1)}%</span>
                            <span className="text-muted-foreground font-normal">vs yesterday</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{feesToday.length} transactions</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-emerald-600/50" />
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-blue-200 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Bid Fees</p>
                        <p className="text-2xl font-bold text-foreground mt-1">KES {breakdownToday.totalBidFees.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">{breakdownToday.bidFees.length} transactions</p>
                        {breakdownToday.totalBidFees > 0 && totalFeesToday > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {((breakdownToday.totalBidFees / totalFeesToday) * 100).toFixed(1)}% of today's total
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-2xl">💳</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* This Week Tab */}
              <TabsContent value="week" className="space-y-4 mt-4">
                <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Fees Paid This Week</p>
                      <p className="text-3xl font-bold text-foreground mt-2">KES {totalFeesThisWeek.toLocaleString()}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {weekPercentageChange !== 0 && (
                          <div className={`flex items-center gap-1 text-sm font-semibold ${
                            weekPercentageChange > 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {weekPercentageChange > 0 ? (
                              <ArrowUp className="w-4 h-4" />
                            ) : (
                              <ArrowDown className="w-4 h-4" />
                            )}
                            <span>{Math.abs(weekPercentageChange).toFixed(1)}%</span>
                            <span className="text-muted-foreground font-normal">vs last week</span>
                          </div>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{feesThisWeek.length} transactions</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-blue-600/50" />
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-blue-200 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Bid Fees</p>
                        <p className="text-2xl font-bold text-foreground mt-1">KES {breakdownThisWeek.totalBidFees.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">{breakdownThisWeek.bidFees.length} transactions</p>
                        {breakdownThisWeek.totalBidFees > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {((breakdownThisWeek.totalBidFees / totalFeesThisWeek) * 100).toFixed(1)}% of weekly total
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-2xl">💳</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* All Time Tab */}
              <TabsContent value="all" className="space-y-4 mt-4">
                <Card className="p-6 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Total Fees Paid (All Time)</p>
                      <p className="text-3xl font-bold text-foreground mt-2">KES {totalFeesPaid.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">{paidFees.length} transactions</p>
                    </div>
                    <DollarSign className="w-10 h-10 text-emerald-600/50" />
                  </div>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="p-4 border-blue-200 bg-blue-50/50">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Bid Fees</p>
                        <p className="text-2xl font-bold text-foreground mt-1">KES {breakdownAllTime.totalBidFees.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">{breakdownAllTime.bidFees.length} transactions</p>
                        {breakdownAllTime.totalBidFees > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            {((breakdownAllTime.totalBidFees / totalFeesPaid) * 100).toFixed(1)}% of total
                          </p>
                        )}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <span className="text-2xl">💳</span>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>

              {/* Live Data Tab - Auto-swiping transaction viewer */}
              <TabsContent value="live" className="space-y-4 mt-4">
                {paidFees.length === 0 ? (
                  <Card className="p-8 text-center">
                    <p className="text-muted-foreground">No fee payments yet</p>
                  </Card>
                ) : (
                  <AutoSwipeTransactionViewer 
                    transactions={paidFees
                      .sort((a: any, b: any) => {
                        const dateA = new Date(a.paymentDate || a.createdAt || 0).getTime();
                        const dateB = new Date(b.paymentDate || b.createdAt || 0).getTime();
                        return dateB - dateA;
                      })
                    }
                    getDisplayName={getDisplayName}
                  />
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Admins Dialog */}
        <Dialog open={showAdminsDialog} onOpenChange={setShowAdminsDialog}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <span>Admin Users ({admins.length})</span>
                {isSuperAdmin && (
                  <Button
                    onClick={() => setShowAddAdminForm(true)}
                    size="sm"
                    className="gap-2"
                    disabled={createAdminMutation.isPending}
                  >
                    <Plus className="w-4 h-4" />
                    Add Admin
                  </Button>
                )}
              </DialogTitle>
            </DialogHeader>
            {!isSuperAdmin && (
              <Card className="p-4 bg-muted border-border">
                <p className="text-sm text-muted-foreground">
                  Only the super admin can create new admin users.
                </p>
              </Card>
            )}
            {/* Add Admin Form */}
            {showAddAdminForm && (
              <Card className="p-6 mb-4 border-2 border-primary">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-bold text-foreground">Create New Admin User</h3>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setShowAddAdminForm(false);
                        setNewAdminForm({ username: "", password: "", confirmPassword: "", superAdminPassword: "" });
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="new-username">Username *</Label>
                      <Input
                        id="new-username"
                        value={newAdminForm.username}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, username: e.target.value })}
                        placeholder="3-50 characters, alphanumeric, underscores, dashes"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Only letters, numbers, underscores, and dashes allowed
                      </p>
                    </div>
                    
                    <div>
                      <Label htmlFor="new-password">Password *</Label>
                      <Input
                        id="new-password"
                        type="password"
                        value={newAdminForm.password}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, password: e.target.value })}
                        placeholder="Minimum 8 characters"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="confirm-password">Confirm Password *</Label>
                      <Input
                        id="confirm-password"
                        type="password"
                        value={newAdminForm.confirmPassword}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, confirmPassword: e.target.value })}
                        placeholder="Re-enter password"
                        className="mt-1"
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor="super-admin-password">Your Admin Password *</Label>
                      <Input
                        id="super-admin-password"
                        type="password"
                        value={newAdminForm.superAdminPassword}
                        onChange={(e) => setNewAdminForm({ ...newAdminForm, superAdminPassword: e.target.value })}
                        placeholder="Enter your admin password to confirm"
                        className="mt-1"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Required to verify you have permission to create admin users
                      </p>
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        onClick={() => {
                          // Validate
                          if (!newAdminForm.username || !newAdminForm.password || !newAdminForm.confirmPassword || !newAdminForm.superAdminPassword) {
                            alert("All fields are required");
                            return;
                          }
                          
                          if (!/^[a-zA-Z0-9_-]{3,50}$/.test(newAdminForm.username)) {
                            alert("Username must be 3-50 characters and contain only letters, numbers, underscores, and dashes");
                            return;
                          }
                          
                          if (newAdminForm.password.length < 8) {
                            alert("Password must be at least 8 characters");
                            return;
                          }
                          
                          if (newAdminForm.password !== newAdminForm.confirmPassword) {
                            alert("Passwords do not match");
                            return;
                          }
                          
                          createAdminMutation.mutate({
                            username: newAdminForm.username,
                            password: newAdminForm.password,
                            superAdminPassword: newAdminForm.superAdminPassword,
                          }, {
                            onSuccess: () => {
                              setShowAddAdminForm(false);
                              setNewAdminForm({ username: "", password: "", confirmPassword: "", superAdminPassword: "" });
                            }
                          });
                        }}
                        disabled={createAdminMutation.isPending}
                        className="flex-1"
                      >
                        {createAdminMutation.isPending ? "Creating..." : "Create Admin"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddAdminForm(false);
                          setNewAdminForm({ username: "", password: "", confirmPassword: "", superAdminPassword: "" });
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            )}
            
            {adminsLoading ? (
              <Card className="p-6"><p className="text-muted-foreground">Loading...</p></Card>
            ) : admins.length === 0 ? (
              <Card className="p-6"><p className="text-muted-foreground">No admin users found</p></Card>
            ) : (
              <div className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-3 px-4 font-semibold text-foreground">ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Username</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Created</th>
                        <th className="text-left py-3 px-4 font-semibold text-foreground">Last Login</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">Status</th>
                        <th className="text-center py-3 px-4 font-semibold text-foreground">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin: any) => (
                        <tr key={admin.id} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="py-3 px-4 text-sm font-mono text-foreground">{admin.id}</td>
                          <td className="py-3 px-4 text-sm font-medium text-foreground">{admin.username}</td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {admin.created_at ? new Date(admin.created_at).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }) : "-"}
                          </td>
                          <td className="py-3 px-4 text-sm text-muted-foreground">
                            {admin.last_login ? new Date(admin.last_login).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }) : "Never"}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <Badge variant={admin.is_active ? "default" : "secondary"}>
                              {admin.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {admin.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (!confirm(`Are you sure you want to deactivate admin "${admin.username}"?`)) {
                                    return;
                                  }
                                  try {
                                    const response = await fetch(`/api/admin/admins/${admin.id}`, {
                                      method: "DELETE",
                                    });
                                    if (response.ok) {
                                      queryClient.invalidateQueries({ queryKey: ["/api/admin/admins"] });
                                    } else {
                                      const error = await response.json();
                                      alert(error.error || "Failed to deactivate admin");
                                    }
                                  } catch (error) {
                                    alert("Error deactivating admin");
                                  }
                                }}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {createAdminMutation.isPending && (
                  <Card className="p-4 bg-muted">
                    <p className="text-sm text-muted-foreground">Creating admin user...</p>
                  </Card>
                )}
                {createAdminMutation.isError && (
                  <Card className="p-4 bg-destructive/10 border-destructive">
                    <p className="text-sm text-destructive">
                      {createAdminMutation.error instanceof Error 
                        ? createAdminMutation.error.message 
                        : "Failed to create admin user"}
                    </p>
                  </Card>
                )}
                {createAdminMutation.isSuccess && (
                  <Card className="p-4 bg-green-500/10 border-green-500">
                    <p className="text-sm text-green-600">Admin user created successfully!</p>
                  </Card>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </LoginGate>
  );
}

// Auto-swiping Transaction Viewer Component for Live Data tab
function AutoSwipeTransactionViewer({ transactions, getDisplayName }: { transactions: any[], getDisplayName: (tx: any) => string }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-advance to next transaction every 5 seconds
  useEffect(() => {
    if (transactions.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev < transactions.length - 1) {
          return prev + 1;
        } else {
          // Loop back to start
          return 0;
        }
      });
    }, 5000); // 5 seconds per transaction

    return () => clearInterval(interval);
  }, [transactions.length]);

  const goNext = () => {
    if (currentIndex < transactions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setCurrentIndex(0); // Loop to start
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    } else {
      setCurrentIndex(transactions.length - 1); // Loop to end
    }
  };

  const tx = transactions[currentIndex];
  const displayName = getDisplayName(tx);

  return (
    <div className="space-y-4">
      {/* Navigation Info */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>Transaction {currentIndex + 1} of {transactions.length}</span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goNext}
            disabled={currentIndex === transactions.length - 1}
            className="gap-2"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Transaction Card */}
      <Card className="p-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-foreground">Transaction Details</h3>
            {tx.type === 'bid_fee' && (
              <Badge variant="default" className="bg-blue-500">💳 Bid Fee</Badge>
            )}
            {tx.type === 'fee' && (
              <Badge variant="default">Fee</Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Phone Number</p>
              <p className="text-sm font-mono text-foreground">{tx.phoneNumber || '-'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Name</p>
              <p className="text-sm text-foreground">{displayName}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Amount</p>
              <p className="text-lg font-bold text-foreground">KES {parseFloat(tx.amount || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Source</p>
              <Badge variant={tx.source === 'web' ? 'default' : 'secondary'}>
                {tx.source === 'web' ? '🌐 Web' : '📱 USSD'}
              </Badge>
            </div>
            <div className="md:col-span-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Date</p>
              <p className="text-sm text-foreground">
                {tx.paymentDate 
                  ? new Date(tx.paymentDate).toLocaleString("en-KE", { 
                      timeZone: "Africa/Nairobi",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit"
                    })
                  : tx.createdAt 
                    ? new Date(tx.createdAt).toLocaleString("en-KE", { 
                        timeZone: "Africa/Nairobi",
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit"
                      })
                    : '-'
                }
              </p>
            </div>
            {tx.mpesaReceipt && (
              <div className="md:col-span-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">M-Pesa Receipt</p>
                <p className="text-sm font-mono text-foreground">{tx.mpesaReceipt}</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Swipe Hint */}
      <p className="text-xs text-center text-muted-foreground">
        Swipe left/right or use buttons to navigate
      </p>
    </div>
  );
}
