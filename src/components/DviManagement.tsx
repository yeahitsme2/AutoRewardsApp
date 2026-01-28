import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { logAuditEvent } from '../lib/audit';
import { logOutboundMessage } from '../lib/messaging';
import { buildReportItems } from '../lib/dvi';
import { ClipboardCheck, Plus, X, CheckCircle } from 'lucide-react';
import type { DviItemMedia, DviReport, DviReportItem, DviTemplate, DviTemplateItem, DviTemplateSection, RepairOrder } from '../types/database';

type TemplateWithSections = DviTemplate & {
  sections: Array<DviTemplateSection & { items: DviTemplateItem[] }>;
};

type ReportWithItems = DviReport & {
  items: DviReportItem[];
  media: DviItemMedia[];
};

export function DviManagement() {
  const { admin } = useAuth();
  const { brandSettings } = useBrand();
  const [templates, setTemplates] = useState<TemplateWithSections[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [newSectionTitle, setNewSectionTitle] = useState('');
  const [newItemTitle, setNewItemTitle] = useState<Record<string, string>>({});
  const [newItemDesc, setNewItemDesc] = useState<Record<string, string>>({});
  const [newItemRec, setNewItemRec] = useState<Record<string, string>>({});

  const [reports, setReports] = useState<DviReport[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [reportItems, setReportItems] = useState<DviReportItem[]>([]);
  const [reportMedia, setReportMedia] = useState<DviItemMedia[]>([]);
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [newReportTemplateId, setNewReportTemplateId] = useState('');
  const [newReportRoId, setNewReportRoId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  );

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadTemplates();
    loadReports();
    loadRepairOrders();
  }, [admin?.shop_id]);

  useEffect(() => {
    if (selectedReportId) {
      loadReportItems(selectedReportId);
    }
  }, [selectedReportId]);

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const loadTemplates = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data: templateRows, error } = await supabase
        .from('dvi_templates')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const templateIds = (templateRows || []).map((t) => t.id);
      const { data: sectionRows, error: sectionError } = await supabase
        .from('dvi_template_sections')
        .select('*')
        .in('template_id', templateIds.length > 0 ? templateIds : ['00000000-0000-0000-0000-000000000000']);
      if (sectionError) throw sectionError;

      const sectionIds = (sectionRows || []).map((s) => s.id);
      const { data: itemRows, error: itemError } = await supabase
        .from('dvi_template_items')
        .select('*')
        .in('section_id', sectionIds.length > 0 ? sectionIds : ['00000000-0000-0000-0000-000000000000']);
      if (itemError) throw itemError;

      const nextTemplates: TemplateWithSections[] = (templateRows || []).map((template) => {
        const sections = (sectionRows || [])
          .filter((section) => section.template_id === template.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((section) => ({
            ...section,
            items: (itemRows || [])
              .filter((item) => item.section_id === section.id)
              .sort((a, b) => a.sort_order - b.sort_order),
          }));
        return { ...(template as DviTemplate), sections };
      });
      setTemplates(nextTemplates);
      const defaultTemplateId =
        nextTemplates.find((template) => template.is_default)?.id
        || nextTemplates[0]?.id
        || null;
      if (defaultTemplateId) {
        setSelectedTemplateId((current) => current || defaultTemplateId);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadReports = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('dvi_reports')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReports((data || []) as DviReport[]);
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const loadRepairOrders = async () => {
    if (!admin?.shop_id) return;
    try {
      const { data, error } = await supabase
        .from('repair_orders')
        .select('*')
        .eq('shop_id', admin.shop_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setRepairOrders((data || []) as RepairOrder[]);
    } catch (error) {
      console.error('Failed to load repair orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadReportItems = async (reportId: string) => {
    try {
      const { data: items, error } = await supabase
        .from('dvi_report_items')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const { data: mediaRows, error: mediaError } = await supabase
        .from('dvi_item_media')
        .select('*')
        .in('report_item_id', (items || []).map((item) => item.id));
      if (mediaError) throw mediaError;
      setReportItems((items || []) as DviReportItem[]);
      setReportMedia((mediaRows || []) as DviItemMedia[]);
    } catch (error) {
      console.error('Failed to load report items:', error);
    }
  };

  const handleCreateTemplate = async () => {
    if (!admin?.shop_id || !templateName.trim()) {
      showMessage('error', 'Enter a template name');
      return;
    }
    try {
      const { data, error } = await supabase
        .from('dvi_templates')
        .insert({
          shop_id: admin.shop_id,
          name: templateName.trim(),
        })
        .select('*')
        .single();
      if (error) throw error;
      setTemplateName('');
      setSelectedTemplateId((data as DviTemplate).id);
      await loadTemplates();
      showMessage('success', 'Template created');
    } catch (error) {
      console.error('Failed to create template:', error);
      showMessage('error', 'Failed to create template');
    }
  };

  const handleAddSection = async () => {
    if (!selectedTemplateId || !newSectionTitle.trim()) return;
    try {
      const { error } = await supabase
        .from('dvi_template_sections')
        .insert({
          template_id: selectedTemplateId,
          title: newSectionTitle.trim(),
          sort_order: selectedTemplate?.sections.length || 0,
        });
      if (error) throw error;
      setNewSectionTitle('');
      await loadTemplates();
    } catch (error) {
      console.error('Failed to add section:', error);
    }
  };

  const handleAddItem = async (sectionId: string) => {
    const title = newItemTitle[sectionId]?.trim();
    if (!title) return;
    try {
      const { error } = await supabase
        .from('dvi_template_items')
        .insert({
          section_id: sectionId,
          title,
          description: newItemDesc[sectionId] || null,
          default_recommendation: newItemRec[sectionId] || null,
          sort_order: selectedTemplate?.sections.find((s) => s.id === sectionId)?.items.length || 0,
        });
      if (error) throw error;
      setNewItemTitle((prev) => ({ ...prev, [sectionId]: '' }));
      setNewItemDesc((prev) => ({ ...prev, [sectionId]: '' }));
      setNewItemRec((prev) => ({ ...prev, [sectionId]: '' }));
      await loadTemplates();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const handleCreateReport = async () => {
    if (!admin?.shop_id || !newReportRoId || !newReportTemplateId) {
      showMessage('error', 'Select a repair order and template');
      return;
    }
    try {
      const ro = repairOrders.find((r) => r.id === newReportRoId);
      if (!ro) throw new Error('Repair order not found');
      const { data: report, error } = await supabase
        .from('dvi_reports')
        .insert({
          shop_id: admin.shop_id,
          repair_order_id: ro.id,
          customer_id: ro.customer_id,
          vehicle_id: ro.vehicle_id || null,
          template_id: newReportTemplateId,
          status: 'draft',
          created_by: admin.auth_user_id,
        })
        .select('*')
        .single();
      if (error) throw error;

      const template = templates.find((t) => t.id === newReportTemplateId) || null;
      const itemsToInsert = buildReportItems((report as DviReport).id, template);

      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('dvi_report_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'dvi_report_created',
        entityType: 'dvi_report',
        entityId: (report as DviReport).id,
        metadata: { repair_order_id: ro.id },
      });

      setNewReportRoId('');
      setNewReportTemplateId('');
      await loadReports();
      showMessage('success', 'DVI report created');
    } catch (error) {
      console.error('Failed to create report:', error);
      showMessage('error', 'Failed to create report');
    }
  };

  const handleUpdateItem = async (itemId: string, updates: Partial<DviReportItem>) => {
    try {
      const { error } = await supabase
        .from('dvi_report_items')
        .update(updates)
        .eq('id', itemId);
      if (error) throw error;
      setReportItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
    } catch (error) {
      console.error('Failed to update report item:', error);
    }
  };

  const handlePublishReport = async () => {
    if (!selectedReportId || !admin?.shop_id) return;
    try {
      const report = reports.find((r) => r.id === selectedReportId);
      const { error } = await supabase
        .from('dvi_reports')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', selectedReportId);
      if (error) throw error;
      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'admin',
        eventType: 'dvi_report_published',
        entityType: 'dvi_report',
        entityId: selectedReportId,
      });
      if (report?.customer_id) {
        await logOutboundMessage({
          shopId: admin.shop_id,
          customerId: report.customer_id,
          channel: 'email',
          subject: 'Your inspection report is ready',
          body: 'Your digital vehicle inspection report is now available in your customer portal.',
          status: 'queued',
        });
      }
      showMessage('success', 'Report published');
      loadReports();
    } catch (error) {
      console.error('Failed to publish report:', error);
      showMessage('error', 'Failed to publish report');
    }
  };

  const handleConvertFindings = async () => {
    if (!selectedReportId) return;
    const report = reports.find((r) => r.id === selectedReportId);
    if (!report) return;
    const convertible = reportItems.filter((item) => item.condition !== 'green' && !item.repair_order_item_id);
    if (convertible.length === 0) {
      showMessage('error', 'No findings to convert');
      return;
    }
    try {
      const inserts = convertible.map((item) => ({
        repair_order_id: report.repair_order_id,
        item_type: 'labor',
        description: item.recommendation || 'Inspection finding',
        quantity: 1,
        unit_price: 0,
        total: 0,
        taxable: true,
      }));
      const { data, error } = await supabase
        .from('repair_order_items')
        .insert(inserts)
        .select('*');
      if (error) throw error;
      const inserted = data || [];
      const updatePromises = inserted.map((roItem, idx) =>
        supabase.from('dvi_report_items').update({ repair_order_item_id: roItem.id }).eq('id', convertible[idx].id)
      );
      await Promise.all(updatePromises);
      showMessage('success', 'Findings converted to RO line items');
      loadReportItems(selectedReportId);
    } catch (error) {
      console.error('Failed to convert findings:', error);
      showMessage('error', 'Failed to convert findings');
    }
  };

  const handleUploadMedia = async (itemId: string, file: File) => {
    try {
      const path = `dvi/${selectedReportId}/${itemId}/${Date.now()}-${file.name}`;
      const upload = await supabase.storage.from('dvi-attachments').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('dvi_item_media').insert({
        report_item_id: itemId,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        file_size: file.size,
      });
      if (error) throw error;
      if (selectedReportId) loadReportItems(selectedReportId);
    } catch (error) {
      console.error('Failed to upload DVI media:', error);
    }
  };

  const getMediaForItem = (itemId: string) => reportMedia.filter((media) => media.report_item_id === itemId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-600">Loading inspections...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {message && (
        <div
          className="p-4 rounded-lg"
          style={message.type === 'success' ? {
            backgroundColor: `${brandSettings.primary_color}10`,
            color: brandSettings.primary_color
          } : { backgroundColor: '#fef2f2', color: '#991b1b' }}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Digital Vehicle Inspections</h2>
          <p className="text-slate-600">Build inspection templates and publish reports to customers.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={newReportRoId}
            onChange={(e) => setNewReportRoId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Select RO</option>
            {repairOrders.map((ro) => (
              <option key={ro.id} value={ro.id}>{ro.ro_number}</option>
            ))}
          </select>
          <select
            value={newReportTemplateId}
            onChange={(e) => setNewReportTemplateId(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
          >
            <option value="">Select Template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}</option>
            ))}
          </select>
          <button
            onClick={handleCreateReport}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg"
            style={{ backgroundColor: brandSettings.primary_color }}
          >
            <Plus className="w-4 h-4" />
            Create Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Templates</h3>
            <div className="flex gap-2">
              <input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="New template name"
                className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
              <button
                onClick={handleCreateTemplate}
                className="px-3 py-2 text-white rounded-lg"
                style={{ backgroundColor: brandSettings.primary_color }}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2">
              {templates.length === 0 && <p className="text-sm text-slate-500">No templates yet.</p>}
              {templates.map((template) => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplateId(template.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedTemplateId === template.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div className="font-medium text-slate-900">{template.name}</div>
                  <div className="text-xs text-slate-500">{template.sections.length} sections</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
            <h3 className="font-semibold text-slate-900">Reports</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {reports.length === 0 && <p className="text-sm text-slate-500">No reports yet.</p>}
              {reports.map((report) => (
                <button
                  key={report.id}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border ${
                    selectedReportId === report.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-slate-900">{report.repair_order_id.slice(0, 8)}...</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${report.status === 'published' ? 'bg-emerald-100 text-emerald-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {report.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500">{new Date(report.created_at).toLocaleDateString()}</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {selectedTemplate && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Template: {selectedTemplate.name}</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  value={newSectionTitle}
                  onChange={(e) => setNewSectionTitle(e.target.value)}
                  placeholder="New section title"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                />
                <button
                  onClick={handleAddSection}
                  className="px-3 py-2 text-white rounded-lg"
                  style={{ backgroundColor: brandSettings.primary_color }}
                >
                  Add Section
                </button>
              </div>
              <div className="space-y-4">
                {selectedTemplate.sections.map((section) => (
                  <div key={section.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
                    <div className="font-semibold text-slate-800">{section.title}</div>
                    <div className="space-y-2">
                      {section.items.map((item) => (
                        <div key={item.id} className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
                          <div className="font-medium text-slate-900">{item.title}</div>
                          {item.description && <div className="text-xs text-slate-500">{item.description}</div>}
                          {item.default_recommendation && <div className="text-xs text-slate-500">Rec: {item.default_recommendation}</div>}
                        </div>
                      ))}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      <input
                        value={newItemTitle[section.id] || ''}
                        onChange={(e) => setNewItemTitle((prev) => ({ ...prev, [section.id]: e.target.value }))}
                        placeholder="Item title"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        value={newItemDesc[section.id] || ''}
                        onChange={(e) => setNewItemDesc((prev) => ({ ...prev, [section.id]: e.target.value }))}
                        placeholder="Description (optional)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                      />
                      <input
                        value={newItemRec[section.id] || ''}
                        onChange={(e) => setNewItemRec((prev) => ({ ...prev, [section.id]: e.target.value }))}
                        placeholder="Recommendation (optional)"
                        className="px-3 py-2 border border-slate-300 rounded-lg text-sm md:col-span-2"
                      />
                      <button
                        onClick={() => handleAddItem(section.id)}
                        className="px-3 py-2 text-white rounded-lg md:col-span-2"
                        style={{ backgroundColor: brandSettings.primary_color }}
                      >
                        Add Item
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedReportId && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900">Report Items</h3>
                  <p className="text-xs text-slate-500">Update findings and publish when ready.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleConvertFindings}
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    Convert Findings
                  </button>
                  <button
                    onClick={handlePublishReport}
                    className="flex items-center gap-2 px-3 py-2 text-white rounded-lg text-sm"
                    style={{ backgroundColor: brandSettings.primary_color }}
                  >
                    <CheckCircle className="w-4 h-4" />
                    Publish
                  </button>
                </div>
              </div>
              {reportItems.length === 0 ? (
                <p className="text-sm text-slate-500">No report items yet.</p>
              ) : (
                <div className="space-y-3">
                  {reportItems.map((item) => (
                    <div key={item.id} className="border border-slate-200 rounded-lg p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-slate-900">{item.recommendation || 'Inspection item'}</span>
                        <select
                          value={item.condition}
                          onChange={(e) => handleUpdateItem(item.id, { condition: e.target.value as DviReportItem['condition'] })}
                          className="px-2 py-1 border border-slate-300 rounded-lg text-xs"
                        >
                          <option value="green">Green</option>
                          <option value="yellow">Yellow</option>
                          <option value="red">Red</option>
                        </select>
                      </div>
                      <textarea
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateItem(item.id, { notes: e.target.value })}
                        placeholder="Notes"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                      <textarea
                        value={item.recommendation || ''}
                        onChange={(e) => handleUpdateItem(item.id, { recommendation: e.target.value })}
                        placeholder="Recommendation"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        rows={2}
                      />
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="file"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadMedia(item.id, file);
                            }}
                          />
                          <span className="px-2 py-1 border border-slate-300 rounded-lg">Add photo</span>
                        </label>
                        {getMediaForItem(item.id).map((media) => (
                          <span key={media.id} className="text-xs text-slate-500">{media.file_name}</span>
                        ))}
                      </div>
                      {item.repair_order_item_id && (
                        <p className="text-xs text-emerald-600">Converted to RO line item</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
              <button
                onClick={() => setSelectedReportId(null)}
                className="flex items-center gap-2 text-sm text-slate-600"
              >
                <X className="w-4 h-4" />
                Close report
              </button>
            </div>
          )}

          {!selectedReportId && !selectedTemplate && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
              <ClipboardCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              Select a template or report to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
