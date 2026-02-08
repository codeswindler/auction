import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil, Power, Trash2 } from "lucide-react";

export function CampaignManager() {
  const queryClient = useQueryClient();
  const [includeInactiveCampaigns, setIncludeInactiveCampaigns] = useState(true);
  const [includeInactiveNodes, setIncludeInactiveNodes] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<number | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<any | null>(null);
  const [campaignForm, setCampaignForm] = useState({
    name: "",
    menuTitle: "",
    rootPrompt: "",
    bidFeeMin: "30",
    bidFeeMax: "99",
    bidFeePrompt: "Please complete the bid on MPesa, ref: {{ref}}.",
  });
  const [editingNode, setEditingNode] = useState<any | null>(null);
  const [nodeForm, setNodeForm] = useState({
    parentId: null as number | null,
    label: "",
    prompt: "",
    actionType: "none",
    amount: "",
  });

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
    mutationFn: async (data: { campaignId: number; parentId: number | null; label: string; prompt?: string; actionType?: string; actionPayload?: string; sortOrder?: number; isActive?: boolean }) => {
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
    mutationFn: async (data: { campaignId: number; id: number; parentId?: number | null; label?: string; prompt?: string; actionType?: string; actionPayload?: string; sortOrder?: number; isActive?: boolean }) => {
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

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Menu Modular</h2>
        <p className="text-sm text-muted-foreground">Create and manage USSD campaigns and menu trees.</p>
      </div>

      <Card className="p-4">
        <form onSubmit={handleCampaignSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-2">
            <Label htmlFor="campaign-name">Name</Label>
            <Input
              id="campaign-name"
              value={campaignForm.name}
              onChange={(e) => setCampaignForm({ ...campaignForm, name: e.target.value })}
              placeholder="e.g. Auction Campaign"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-menu-title">Menu Title</Label>
            <Input
              id="campaign-menu-title"
              value={campaignForm.menuTitle}
              onChange={(e) => setCampaignForm({ ...campaignForm, menuTitle: e.target.value })}
              placeholder="Auctions"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-root-prompt">Root Prompt</Label>
            <Input
              id="campaign-root-prompt"
              value={campaignForm.rootPrompt}
              onChange={(e) => setCampaignForm({ ...campaignForm, rootPrompt: e.target.value })}
              placeholder="Select one of below active auctions:"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-bid-fee-min">Bid Fee Min (KES)</Label>
            <Input
              id="campaign-bid-fee-min"
              type="number"
              min="0"
              value={campaignForm.bidFeeMin}
              onChange={(e) => setCampaignForm({ ...campaignForm, bidFeeMin: e.target.value })}
              placeholder="30"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="campaign-bid-fee-max">Bid Fee Max (KES)</Label>
            <Input
              id="campaign-bid-fee-max"
              type="number"
              min="0"
              value={campaignForm.bidFeeMax}
              onChange={(e) => setCampaignForm({ ...campaignForm, bidFeeMax: e.target.value })}
              placeholder="99"
              required
            />
          </div>
          <div className="space-y-2 md:col-span-3">
            <Label htmlFor="campaign-bid-fee-prompt">Bid Fee Prompt</Label>
            <Input
              id="campaign-bid-fee-prompt"
              value={campaignForm.bidFeePrompt}
              onChange={(e) => setCampaignForm({ ...campaignForm, bidFeePrompt: e.target.value })}
              placeholder="Please complete the bid on MPesa, ref: {{ref}}."
              required
            />
            <p className="text-xs text-muted-foreground">Use {"{{ref}}"} to include the reference code.</p>
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1" disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}>
              {editingCampaign ? "Update Campaign" : "Add Campaign"}
            </Button>
            {editingCampaign && (
              <Button type="button" variant="outline" onClick={resetCampaignForm}>
                Cancel
              </Button>
            )}
          </div>
        </form>
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted-foreground">Manage USSD campaigns and choose which is active.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIncludeInactiveCampaigns(!includeInactiveCampaigns)}
          >
            {includeInactiveCampaigns ? "Hide inactive" : "Show inactive"}
          </Button>
        </div>
      </Card>

      {campaignsLoading ? (
        <Card className="p-6"><p className="text-muted-foreground">Loading...</p></Card>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 font-semibold text-foreground">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-foreground">Menu Title</th>
                <th className="text-center py-3 px-4 font-semibold text-foreground">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {safeCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-muted-foreground">
                    No campaigns found
                  </td>
                </tr>
              ) : (
                safeCampaigns.map((campaign: any) => (
                  <tr
                    key={campaign.id}
                    onClick={() => setSelectedCampaignId(campaign.id)}
                    className={`border-b border-border/50 cursor-pointer ${selectedCampaignId === campaign.id ? "bg-muted/50" : "hover:bg-muted/30"}`}
                  >
                    <td className="py-3 px-4 text-sm text-foreground">{campaign.name}</td>
                    <td className="py-3 px-4 text-sm text-foreground">{campaign.menuTitle}</td>
                    <td className="py-3 px-4 text-center">
                      <Badge variant={campaign.isActive ? "default" : "secondary"}>
                        {campaign.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedCampaignId(campaign.id);
                            setEditingCampaign(campaign);
                            setCampaignForm({
                              name: campaign.name,
                              menuTitle: campaign.menuTitle,
                              rootPrompt: campaign.rootPrompt,
                              bidFeeMin: campaign.bidFeeMin ?? "30",
                              bidFeeMax: campaign.bidFeeMax ?? "99",
                              bidFeePrompt: campaign.bidFeePrompt ?? "Please complete the bid on MPesa, ref: {{ref}}.",
                            });
                          }}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedCampaignId(campaign.id);
                            if (campaign.isActive) {
                              updateCampaignMutation.mutate({ id: campaign.id, isActive: false });
                            } else {
                              activateCampaignMutation.mutate(campaign.id);
                            }
                          }}
                          className={campaign.isActive ? "text-emerald-600" : "text-muted-foreground"}
                        >
                          <Power className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      <Card className="p-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Campaign Nodes</h3>
            <p className="text-xs text-muted-foreground">
              {selectedCampaign?.name ? `Editing: ${selectedCampaign.name}` : "Select a campaign to manage nodes."}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIncludeInactiveNodes(!includeInactiveNodes)}
            disabled={!selectedCampaign}
          >
            {includeInactiveNodes ? "Hide inactive nodes" : "Show inactive nodes"}
          </Button>
        </div>

        <form onSubmit={handleNodeSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="node-label">Label</Label>
            <Input
              id="node-label"
              value={nodeForm.label}
              onChange={(e) => setNodeForm({ ...nodeForm, label: e.target.value })}
              placeholder="e.g. Bike"
              required
              disabled={!selectedCampaign}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="node-prompt">Prompt (shown when this node has children)</Label>
            <Input
              id="node-prompt"
              value={nodeForm.prompt}
              onChange={(e) => setNodeForm({ ...nodeForm, prompt: e.target.value })}
              placeholder="Choose a model..."
              disabled={!selectedCampaign}
            />
          </div>
          <div className="space-y-2">
            <Label>Action</Label>
            <Select
              value={nodeForm.actionType}
              onValueChange={(value) => setNodeForm({ ...nodeForm, actionType: value })}
              disabled={!selectedCampaign}
            >
              <SelectTrigger>
                <SelectValue placeholder="No action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No action</SelectItem>
                <SelectItem value="bid">Bid (payment)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Amount (KES)</Label>
            <Input
              type="number"
              min="1"
              value={nodeForm.amount}
              onChange={(e) => setNodeForm({ ...nodeForm, amount: e.target.value })}
              placeholder="150000"
              disabled={!selectedCampaign || nodeForm.actionType !== "bid"}
            />
          </div>
          <div className="flex gap-2 md:col-span-4">
            <Button type="submit" className="flex-1" disabled={!selectedCampaign || createNodeMutation.isPending || updateNodeMutation.isPending}>
              {editingNode ? "Update Node" : "Add Node"}
            </Button>
            {(editingNode || nodeForm.parentId !== null) && (
              <Button type="button" variant="outline" onClick={() => resetNodeForm()}>
                Clear
              </Button>
            )}
          </div>
          {nodeForm.parentId !== null && (
            <p className="text-xs text-muted-foreground md:col-span-4">
              Adding under parent ID: {nodeForm.parentId}
            </p>
          )}
        </form>
      </Card>

      {nodesLoading ? (
        <Card className="p-6"><p className="text-muted-foreground">Loading nodes...</p></Card>
      ) : !selectedCampaign ? (
        <Card className="p-6"><p className="text-muted-foreground">Select a campaign to manage its menu tree.</p></Card>
      ) : (
        <div className="border border-border rounded-lg p-4">
          {safeCampaignNodes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No nodes yet. Add a root node to start.</p>
          ) : (
            <div>{renderNodes(null, 0)}</div>
          )}
        </div>
      )}
    </section>
  );
}
