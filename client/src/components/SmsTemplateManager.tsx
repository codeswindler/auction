import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { MessageSquare, Plus, Edit, Trash2, Check, X, AlertCircle } from "lucide-react";
import { api } from "@shared/routes";

const TRANSACTION_TYPES = [
  { value: 'welcome', label: 'Welcome', description: 'Sent when user dials for the first time', used: true },
  { value: 'bid_success', label: 'Bid Success', description: 'Sent when bid or bid fee payment succeeds', used: true },
  { value: 'payment_failed', label: 'Payment Failed', description: 'Sent when payment fails or is cancelled', used: true },
] as const;

type TransactionType = typeof TRANSACTION_TYPES[number]['value'];

interface SmsTemplate {
  id: number;
  transactionType: TransactionType;
  templateText: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export function SmsTemplateManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedType, setSelectedType] = useState<TransactionType>('bid_fee');
  const [editingTemplate, setEditingTemplate] = useState<SmsTemplate | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    transactionType: 'welcome' as TransactionType,
    templateText: '',
    isActive: true,
    displayOrder: 0,
  });

  const { data: templates = [], isLoading } = useQuery<SmsTemplate[]>({
    queryKey: ['/api/admin/sms-templates'],
    queryFn: async () => {
      const response = await fetch('/api/admin/sms-templates');
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json();
    },
  });

  const filteredTemplates = templates.filter(t => t.transactionType === selectedType);
  const activeTemplates = filteredTemplates.filter(t => t.isActive);
  const inactiveTemplates = filteredTemplates.filter(t => !t.isActive);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sms-templates'] });
      toast({ title: "Success", description: "Template created successfully" });
      setIsDialogOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      console.log(`[TEMPLATE UPDATE] Updating template ID ${id} with data:`, JSON.stringify(data));
      const response = await fetch(`/api/admin/sms-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sms-templates'] });
      toast({ title: "Success", description: "Template updated successfully" });
      setIsDialogOpen(false);
      setEditingTemplate(null);
      resetForm();
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/admin/sms-templates/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sms-templates'] });
      toast({ title: "Success", description: "Template deleted successfully" });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: number; isActive: boolean }) => {
      const response = await fetch(`/api/admin/sms-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/sms-templates'] });
    },
    onError: (error: Error) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  const resetForm = () => {
    setFormData({
      transactionType: selectedType,
      templateText: '',
      isActive: true,
      displayOrder: 0,
    });
    setEditingTemplate(null);
  };

  const handleEdit = (template: SmsTemplate) => {
    setEditingTemplate(template);
    setFormData({
      transactionType: template.transactionType,
      templateText: template.templateText,
      isActive: template.isActive,
      displayOrder: template.displayOrder,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingTemplate) {
      // Creating new template
      const apiData = {
        transaction_type: formData.transactionType,
        template_text: formData.templateText,
        is_active: formData.isActive,
        display_order: formData.displayOrder,
      };
      createMutation.mutate(apiData);
    } else {
      // Updating existing template - use the template ID
      const apiData = {
        transaction_type: formData.transactionType,
        template_text: formData.templateText,
        is_active: formData.isActive,
        display_order: formData.displayOrder,
      };
      console.log('[TEMPLATE UPDATE] Updating template:', editingTemplate.id, apiData);
      updateMutation.mutate({ id: editingTemplate.id, data: apiData });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm('Are you sure you want to delete this template?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleToggleActive = (id: number, currentActive: boolean) => {
    toggleActiveMutation.mutate({ id, isActive: !currentActive });
  };

  const getTypeLabel = (type: TransactionType) => {
    return TRANSACTION_TYPES.find(t => t.value === type)?.label || type;
  };

  const getTypeDescription = (type: TransactionType) => {
    return TRANSACTION_TYPES.find(t => t.value === type)?.description || '';
  };

  const renderTemplate = (template: SmsTemplate) => {
    const preview = template.templateText
      .replace(/{amount}/g, 'Ksh 50')
      .replace(/{reference}/g, 'ABC123');

    return (
      <Card key={template.id} className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant={template.isActive ? "default" : "secondary"}>
                {template.isActive ? "Active" : "Inactive"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Order: {template.displayOrder}
              </span>
            </div>
            <div className="bg-muted p-3 rounded-md font-mono text-sm whitespace-pre-wrap">
              {preview}
            </div>
            <div className="text-xs text-muted-foreground">
              {template.transactionType === 'welcome' 
                ? <div>No variables</div>
                : <div>Variables: {'{amount}'}, {'{reference}'}</div>}
            </div>
          </div>
          <div className="flex flex-col gap-2 ml-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleEdit(template)}
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleToggleActive(template.id, template.isActive)}
              disabled={toggleActiveMutation.isPending}
            >
              {template.isActive ? (
                <X className="w-4 h-4 text-destructive" />
              ) : (
                <Check className="w-4 h-4 text-green-600" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(template.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-primary" />
          <div>
            <h2 className="text-2xl font-bold">SMS Autoresponse Templates</h2>
            <p className="text-sm text-muted-foreground">
              Manage templates that randomize when sending SMS to bidders (max 5 active per type)
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            // Only reset when closing, not when opening
            setEditingTemplate(null);
            resetForm();
          }
        }}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="w-4 h-4 mr-2" />
              New Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingTemplate ? 'Edit Template' : 'Create New Template'}
              </DialogTitle>
              <DialogDescription>
                Use {'{amount}'} and {'{reference}'} as placeholders. They will be replaced with actual values.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Transaction Type</label>
                <Select
                  value={formData.transactionType}
                  onValueChange={(value) => setFormData({ ...formData, transactionType: value as TransactionType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSACTION_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Template Text</label>
                <Textarea
                  value={formData.templateText}
                  onChange={(e) => setFormData({ ...formData, templateText: e.target.value })}
                  placeholder={formData.transactionType === 'welcome' 
                    ? "Welcome to LiveAuction!&#10;Start bidding now and win amazing prizes.&#10;Dial *855*22# to begin!"
                    : formData.transactionType === 'bid_success'
                    ? "Bid fee Ksh {amount} received! Ref: {reference}&#10;Your bid is LIVE! Others are bidding too...&#10;Stay sharp! Dial *855*22#"
                    : "Payment of Ksh {amount} failed.&#10;Don't miss out! Dial *855*22# to retry now."}
                  rows={6}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  {formData.transactionType === 'welcome' 
                    ? 'No variables needed for welcome messages'
                    : `Available variables: {'{amount}'}, {'{reference}'}`}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                    className="rounded"
                  />
                  <label htmlFor="isActive" className="text-sm font-medium">
                    Active (will be used for randomization)
                  </label>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Order:</label>
                  <Input
                    type="number"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="w-20"
                    min="0"
                  />
                </div>
              </div>
              {activeTemplates.length >= 5 && formData.isActive && !editingTemplate && (
                <div className="flex items-center gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                  <p className="text-sm text-yellow-600">
                    Maximum 5 active templates allowed for this transaction type. Deactivate one first.
                  </p>
                </div>
              )}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={selectedType} onValueChange={(value) => setSelectedType(value as TransactionType)}>
        <TabsList className="grid w-full grid-cols-3">
          {TRANSACTION_TYPES.map(type => (
            <TabsTrigger key={type.value} value={type.value} title={type.description}>
              {type.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TRANSACTION_TYPES.map(type => (
          <TabsContent key={type.value} value={type.value} className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{getTypeLabel(type.value)} Templates</h3>
                <p className="text-sm text-muted-foreground">
                  {getTypeDescription(type.value)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {activeTemplates.length} active, {inactiveTemplates.length} inactive
                </p>
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
            ) : (
              <>
                {activeTemplates.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Active Templates</h4>
                    {activeTemplates.map(renderTemplate)}
                  </div>
                )}
                {inactiveTemplates.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-muted-foreground">Inactive Templates</h4>
                    {inactiveTemplates.map(renderTemplate)}
                  </div>
                )}
                {filteredTemplates.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    No templates for this transaction type. Create one to get started.
                  </div>
                )}
              </>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </Card>
  );
}
