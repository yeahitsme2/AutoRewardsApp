import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { useBrand } from '../lib/BrandContext';
import { logAuditEvent } from '../lib/audit';
import { logOutboundMessage } from '../lib/messaging';
import { buildCustomReportItem, buildReportItems } from '../lib/dvi';
import { CheckCircle, ListChecks, Loader2, Plus, Save, Send, SlidersHorizontal } from 'lucide-react';
import { TechnicianRoQueue } from './technician/TechnicianRoQueue';
import { ItemDetailDrawer, MediaAttachment } from './technician/ItemDetailDrawer';
import type {
  DviItemMedia,
  DviReport,
  DviReportItem,
  DviReportMedia,
  DviTemplate,
  DviTemplateItem,
  DviTemplateSection,
  RepairOrder,
} from '../types/database';

type TemplateWithSections = DviTemplate & {
  sections: Array<DviTemplateSection & { items: DviTemplateItem[] }>;
};

type ChecklistItem = DviReportItem & {
  title: string;
  sectionTitle: string;
  isCustom: boolean;
};

type ChecklistSection = {
  id: string;
  title: string;
  items: ChecklistItem[];
  greenCount: number;
  yellowCount: number;
  redCount: number;
};

export function TechnicianDashboard() {
  const { admin, signOut } = useAuth();
  const { brandSettings } = useBrand();
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [reports, setReports] = useState<DviReport[]>([]);
  const [templates, setTemplates] = useState<TemplateWithSections[]>([]);
  const [selectedRoId, setSelectedRoId] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [reportItems, setReportItems] = useState<DviReportItem[]>([]);
  const [reportMedia, setReportMedia] = useState<DviItemMedia[]>([]);
  const [itemMedia, setItemMedia] = useState<MediaAttachment[]>([]);
  const [reportMediaAttachments, setReportMediaAttachments] = useState<MediaAttachment[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [quickAdd, setQuickAdd] = useState<Record<string, string>>({});
  const [globalSection, setGlobalSection] = useState('');
  const [globalItemTitle, setGlobalItemTitle] = useState('');
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [reportItemCounts, setReportItemCounts] = useState<Record<string, { green: number; yellow: number; red: number }>>({});
  const pendingUpdatesRef = useRef<Record<string, Partial<DviReportItem>>>({});
  const updateTimersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) || null,
    [reports, selectedReportId]
  );

  const selectedTemplate = useMemo(() => {
    if (!selectedReport?.template_id) return null;
    return templates.find((template) => template.id === selectedReport.template_id) || null;
  }, [selectedReport?.template_id, templates]);

  const templateItemLookup = useMemo(() => {
    const map = new Map<string, { item: DviTemplateItem; sectionTitle: string }>();
    templates.forEach((template) => {
      template.sections.forEach((section) => {
        section.items.forEach((item) => {
          map.set(item.id, { item, sectionTitle: section.title });
        });
      });
    });
    return map;
  }, [templates]);

  const templateSectionLookup = useMemo(() => {
    const map = new Map<string, { id: string; title: string }>();
    templates.forEach((template) => {
      template.sections.forEach((section) => {
        map.set(section.id, { id: section.id, title: section.title });
      });
    });
    return map;
  }, [templates]);

  const checklistSections = useMemo<ChecklistSection[]>(() => {
    const groups = new Map<string, ChecklistSection>();

    const defaultSections = selectedTemplate?.sections || [];
    defaultSections.forEach((section) => {
      groups.set(section.id, {
        id: section.id,
        title: section.title,
        items: [],
        greenCount: 0,
        yellowCount: 0,
        redCount: 0,
      });
    });

    reportItems.forEach((item) => {
      const templateMeta = item.template_item_id ? templateItemLookup.get(item.template_item_id) : null;
      const resolvedSection = item.custom_section ? templateSectionLookup.get(item.custom_section) : null;
      const sectionTitle = resolvedSection?.title || item.custom_section || templateMeta?.sectionTitle || 'Custom Items';
      const sectionId = resolvedSection?.id || templateMeta?.item.section_id || sectionTitle;
      if (!groups.has(sectionId)) {
        groups.set(sectionId, {
          id: sectionId,
          title: sectionTitle,
          items: [],
          greenCount: 0,
          yellowCount: 0,
          redCount: 0,
        });
      }
      const checklistItem: ChecklistItem = {
        ...item,
        title: item.custom_title || templateMeta?.item.title || item.recommendation || 'Inspection item',
        sectionTitle,
        isCustom: item.is_custom || Boolean(item.custom_title),
      };
      const section = groups.get(sectionId)!;
      section.items.push(checklistItem);
      if (item.condition === 'green') section.greenCount += 1;
      if (item.condition === 'yellow') section.yellowCount += 1;
      if (item.condition === 'red') section.redCount += 1;
    });

    return Array.from(groups.values()).map((section) => ({
      ...section,
      items: section.items.sort((a, b) => {
        const orderDiff = (a.sort_order || 0) - (b.sort_order || 0);
        if (orderDiff !== 0) return orderDiff;
        return a.created_at.localeCompare(b.created_at);
      }),
    }));
  }, [reportItems, selectedTemplate, templateItemLookup]);

  const totals = useMemo(() => {
    return reportItems.reduce(
      (acc, item) => {
        acc[item.condition] += 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 }
    );
  }, [reportItems]);

  const summarizeItemConditions = (items: DviReportItem[]) =>
    items.reduce(
      (acc, item) => {
        acc[item.condition] += 1;
        return acc;
      },
      { green: 0, yellow: 0, red: 0 }
    );

  useEffect(() => {
    if (!admin?.shop_id) return;
    loadTemplates();
    loadRepairOrders();
    loadReports();
  }, [admin?.shop_id]);

  useEffect(() => {
    if (!selectedReportId) return;
    loadReportItems(selectedReportId);
    loadReportMedia(selectedReportId);
  }, [selectedReportId]);

  useEffect(() => {
    if (!selectedItemId) {
      setItemMedia([]);
      return;
    }
    loadItemMedia(selectedItemId);
  }, [selectedItemId]);

  useEffect(() => {
    if (!selectedReportId) return;
    setReportItemCounts((prev) => ({
      ...prev,
      [selectedReportId]: summarizeItemConditions(reportItems),
    }));
  }, [reportItems, selectedReportId]);

  useEffect(() => {
    if (!selectedReport) return;
    if (globalSection) return;
    const defaultSection = selectedTemplate?.sections?.[0]?.title || 'Custom Items';
    setGlobalSection(defaultSection);
  }, [selectedReport, selectedTemplate, globalSection]);

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
    } catch (error) {
      console.error('Failed to load templates:', error);
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
      await loadReportItemCounts((data || []) as DviReport[]);
      if (!selectedReportId && data && data.length > 0) {
        setSelectedReportId(null);
        setSelectedRoId(null);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    }
  };

  const loadReportItems = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('dvi_report_items')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setReportItems((data || []) as DviReportItem[]);
      setReportItemCounts((prev) => ({
        ...prev,
        [reportId]: summarizeItemConditions((data || []) as DviReportItem[]),
      }));
      if (!data || data.length === 0) {
        setReportMedia([]);
        return;
      }
      const { data: mediaRows, error: mediaError } = await supabase
        .from('dvi_item_media')
        .select('*')
        .in('report_item_id', data.map((item) => item.id));
      if (mediaError) throw mediaError;
      setReportMedia((mediaRows || []) as DviItemMedia[]);
    } catch (error) {
      console.error('Failed to load report items:', error);
    }
  };

  const loadReportMedia = async (reportId: string) => {
    try {
      const { data, error } = await supabase
        .from('dvi_report_media')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const attachments = await buildMediaAttachments(data || []);
      setReportMediaAttachments(attachments);
    } catch (error) {
      console.error('Failed to load report media:', error);
    }
  };

  const loadItemMedia = async (itemId: string) => {
    try {
      const { data, error } = await supabase
        .from('dvi_item_media')
        .select('*')
        .eq('report_item_id', itemId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const attachments = await buildMediaAttachments(data || []);
      setItemMedia(attachments);
    } catch (error) {
      console.error('Failed to load item media:', error);
    }
  };

  const buildMediaAttachments = async (rows: Array<DviItemMedia | DviReportMedia>) => {
    const attachments = await Promise.all(
      rows.map(async (row) => {
        const { data } = await supabase.storage.from('dvi-attachments').createSignedUrl(row.storage_path, 3600);
        return {
          id: row.id,
          storage_path: row.storage_path,
          file_name: row.file_name,
          mime_type: row.mime_type ?? null,
          file_size: row.file_size ?? null,
          media_type: row.media_type ?? null,
          duration_seconds: row.duration_seconds ?? null,
          url: data?.signedUrl || '',
        } as MediaAttachment;
      })
    );
    return attachments.filter((attachment) => attachment.url);
  };

  const loadReportItemCounts = async (reportList: DviReport[]) => {
    const reportIds = reportList.map((report) => report.id);
    if (reportIds.length === 0) {
      setReportItemCounts({});
      return;
    }
    try {
      const { data, error } = await supabase
        .from('dvi_report_items')
        .select('report_id, condition')
        .in('report_id', reportIds);
      if (error) throw error;
      const counts = reportIds.reduce<Record<string, { green: number; yellow: number; red: number }>>(
        (acc, reportId) => {
          acc[reportId] = { green: 0, yellow: 0, red: 0 };
          return acc;
        },
        {}
      );
      (data || []).forEach((row) => {
        counts[row.report_id][row.condition] += 1;
      });
      setReportItemCounts(counts);
    } catch (error) {
      console.error('Failed to load report item counts:', error);
    }
  };

  const createReportForOrder = async (orderId: string) => {
    if (!admin?.shop_id) return;
    const ro = repairOrders.find((order) => order.id === orderId);
    if (!ro) return;
    const template = templates.find((t) => t.is_default) || templates[0] || null;
    if (!template) {
      showMessage('error', 'No template available');
      return;
    }
    try {
      const { data: report, error } = await supabase
        .from('dvi_reports')
        .insert({
          shop_id: admin.shop_id,
          repair_order_id: ro.id,
          customer_id: ro.customer_id,
          vehicle_id: ro.vehicle_id || null,
          template_id: template.id,
          status: 'draft',
          created_by: admin.auth_user_id,
        })
        .select('*')
        .single();
      if (error) throw error;

      const itemsToInsert = buildReportItems((report as DviReport).id, template);
      if (itemsToInsert.length > 0) {
        const { error: itemsError } = await supabase.from('dvi_report_items').insert(itemsToInsert);
        if (itemsError) throw itemsError;
      }

      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'technician',
        eventType: 'dvi_report_created',
        entityType: 'dvi_report',
        entityId: (report as DviReport).id,
        metadata: { repair_order_id: ro.id },
      });

      setSelectedReportId((report as DviReport).id);
      setSelectedRoId(ro.id);
      setSelectedItemId(null);
      setDrawerOpen(true);
      await loadReports();
      showMessage('success', 'Inspection started');
    } catch (error) {
      console.error('Failed to create report:', error);
      showMessage('error', 'Failed to start inspection');
    }
  };

  const queueItemUpdate = (itemId: string, updates: Partial<DviReportItem>) => {
    setReportItems((prev) => prev.map((item) => (item.id === itemId ? { ...item, ...updates } : item)));
    pendingUpdatesRef.current[itemId] = {
      ...pendingUpdatesRef.current[itemId],
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (updateTimersRef.current[itemId]) {
      clearTimeout(updateTimersRef.current[itemId]);
    }

    updateTimersRef.current[itemId] = setTimeout(() => {
      flushItemUpdate(itemId);
    }, 800);
  };

  const flushItemUpdate = async (itemId: string) => {
    const updates = pendingUpdatesRef.current[itemId];
    if (!updates) return;
    try {
      const { error } = await supabase
        .from('dvi_report_items')
        .update(updates)
        .eq('id', itemId);
      if (error) throw error;
      delete pendingUpdatesRef.current[itemId];
    } catch (error) {
      console.error('Failed to save item update:', error);
      showMessage('error', 'Autosave failed. Please retry.');
    }
  };

  const flushAllUpdates = async () => {
    const pending = pendingUpdatesRef.current;
    const itemIds = Object.keys(pending);
    if (itemIds.length === 0) return;
    setSaving(true);
    try {
      await Promise.all(itemIds.map((id) => flushItemUpdate(id)));
      showMessage('success', 'Draft saved');
    } finally {
      setSaving(false);
    }
  };

  const handleMarkInspectionComplete = async () => {
    if (!selectedReport?.repair_order_id || !admin?.shop_id) return;
    try {
      const { error } = await supabase
        .from('repair_orders')
        .update({ status: 'inspection_complete', updated_at: new Date().toISOString() })
        .eq('id', selectedReport.repair_order_id);
      if (error) throw error;
      showMessage('success', 'Inspection marked complete');
      loadRepairOrders();
    } catch (error) {
      console.error('Failed to mark inspection complete:', error);
      showMessage('error', 'Failed to mark inspection complete');
    }
  };

  const handlePublish = async () => {
    if (!selectedReportId || !admin?.shop_id) return;
    try {
      await flushAllUpdates();
      const { error } = await supabase
        .from('dvi_reports')
        .update({ status: 'published', published_at: new Date().toISOString() })
        .eq('id', selectedReportId);
      if (error) throw error;

      if (selectedReport?.repair_order_id) {
        const { error: roError } = await supabase
          .from('repair_orders')
          .update({ status: 'inspection_complete', updated_at: new Date().toISOString() })
          .eq('id', selectedReport.repair_order_id);
        if (roError) throw roError;
      }

      await logAuditEvent({
        shopId: admin.shop_id,
        actorRole: 'technician',
        eventType: 'dvi_report_published',
        entityType: 'dvi_report',
        entityId: selectedReportId,
      });

      if (selectedReport?.customer_id) {
        await logOutboundMessage({
          shopId: admin.shop_id,
          customerId: selectedReport.customer_id,
          channel: 'email',
          subject: 'Inspection report is ready',
          body: 'Your digital vehicle inspection report is now available in the app.',
          status: 'queued',
        });
      }

      showMessage('success', 'Inspection published');
      setPublishConfirm(false);
      loadReports();
    } catch (error) {
      console.error('Failed to publish report:', error);
      showMessage('error', 'Failed to publish inspection');
    }
  };

  const handleAddCustomItem = async (sectionId: string) => {
    if (!selectedReportId) return;
    const title = quickAdd[sectionId]?.trim();
    if (!title) return;
    const section = selectedTemplate?.sections.find((entry) => entry.id === sectionId);
    const resolvedSectionId = section?.id || sectionId;
    try {
      const { data, error } = await supabase
        .from('dvi_report_items')
        .insert(buildCustomReportItem({
          reportId: selectedReportId,
          title,
          sectionTitle: resolvedSectionId,
          sortOrder: reportItems.length + 1,
        }))
        .select('*')
        .single();
      if (error) throw error;
      setReportItems((prev) => [...prev, data as DviReportItem]);
      setQuickAdd((prev) => ({ ...prev, [sectionId]: '' }));
      showMessage('success', 'Item added');
    } catch (error) {
      console.error('Failed to add custom item:', error);
      showMessage('error', 'Failed to add item');
    }
  };

  const handleGlobalQuickAdd = async () => {
    if (!selectedReportId) return;
    const sectionTitle = globalSection.trim();
    const title = globalItemTitle.trim();
    if (!sectionTitle || !title) return;
    const section = selectedTemplate?.sections.find((entry) => entry.title.toLowerCase() === sectionTitle.toLowerCase());
    const sectionId = section?.id || sectionTitle;
    try {
      const { data, error } = await supabase
        .from('dvi_report_items')
        .insert(buildCustomReportItem({
          reportId: selectedReportId,
          title,
          sectionTitle: sectionId,
          sortOrder: reportItems.length + 1,
        }))
        .select('*')
        .single();
      if (error) throw error;
      setReportItems((prev) => [...prev, data as DviReportItem]);
      setGlobalItemTitle('');
      showMessage('success', 'Item added');
    } catch (error) {
      console.error('Failed to add custom item:', error);
      showMessage('error', 'Failed to add item');
    }
  };

  const compressImage = async (file: File) => {
    if (!file.type.startsWith('image/')) return file;
    const imageBitmap = await createImageBitmap(file);
    const maxSize = 1600;
    const scale = Math.min(1, maxSize / Math.max(imageBitmap.width, imageBitmap.height));
    const width = Math.round(imageBitmap.width * scale);
    const height = Math.round(imageBitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(imageBitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.[^/.]+$/, '.jpg'), { type: 'image/jpeg' });
  };
  const uploadItemMedia = async (itemId: string, file: File, mediaType: 'photo' | 'video' | 'audio') => {
    if (!selectedReportId) return;
    try {
      const finalFile = mediaType === 'photo' ? await compressImage(file) : file;
      const path = `dvi/${selectedReportId}/${itemId}/${Date.now()}-${finalFile.name}`;
      const upload = await supabase.storage.from('dvi-attachments').upload(path, finalFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('dvi_item_media').insert({
        report_item_id: itemId,
        storage_path: path,
        file_name: finalFile.name,
        mime_type: finalFile.type,
        file_size: finalFile.size,
        media_type: mediaType,
        created_by: admin?.auth_user_id || null,
      });
      if (error) throw error;
      await loadItemMedia(itemId);
      await loadReportItems(selectedReportId);
    } catch (error) {
      console.error('Failed to upload media:', error);
      showMessage('error', 'Media upload failed');
    }
  };

  const uploadReportMedia = async (file: File, mediaType: 'photo' | 'video' | 'audio') => {
    if (!selectedReportId) return;
    try {
      const finalFile = mediaType === 'photo' ? await compressImage(file) : file;
      const path = `dvi/${selectedReportId}/overview/${Date.now()}-${finalFile.name}`;
      const upload = await supabase.storage.from('dvi-attachments').upload(path, finalFile, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upload.error) throw upload.error;
      const { error } = await supabase.from('dvi_report_media').insert({
        report_id: selectedReportId,
        storage_path: path,
        file_name: finalFile.name,
        mime_type: finalFile.type,
        file_size: finalFile.size,
        media_type: mediaType,
        created_by: admin?.auth_user_id || null,
      });
      if (error) throw error;
      await loadReportMedia(selectedReportId);
    } catch (error) {
      console.error('Failed to upload report media:', error);
      showMessage('error', 'Media upload failed');
    }
  };

  const deleteItemMedia = async (media: MediaAttachment) => {
    try {
      await supabase.storage.from('dvi-attachments').remove([media.storage_path]);
      await supabase.from('dvi_item_media').delete().eq('id', media.id);
      if (selectedItemId) loadItemMedia(selectedItemId);
      if (selectedReportId) loadReportItems(selectedReportId);
    } catch (error) {
      console.error('Failed to delete media:', error);
    }
  };

  const deleteReportMedia = async (media: MediaAttachment) => {
    try {
      await supabase.storage.from('dvi-attachments').remove([media.storage_path]);
      await supabase.from('dvi_report_media').delete().eq('id', media.id);
      if (selectedReportId) loadReportMedia(selectedReportId);
    } catch (error) {
      console.error('Failed to delete report media:', error);
    }
  };

  const queueItems = useMemo(() => {
    const reportByRo = new Map<string, DviReport>();
    reports.forEach((report) => reportByRo.set(report.repair_order_id, report));

    return repairOrders
      .filter((ro) => {
        const report = reportByRo.get(ro.id);
        const matchesSearch = !search
          || ro.ro_number.toLowerCase().includes(search.toLowerCase())
          || ro.temp_customer_name?.toLowerCase().includes(search.toLowerCase());
        if (!matchesSearch) return false;
        return true;
      })
      .map((ro) => {
        const report = reportByRo.get(ro.id) || null;
        const counts = report
          ? reportItemCounts[report.id] || { green: 0, yellow: 0, red: 0 }
          : { green: 0, yellow: 0, red: 0 };

        return {
          id: ro.id,
          roNumber: ro.ro_number,
          customerLabel: ro.temp_customer_name || `Customer ${ro.customer_id?.slice(0, 6)}`,
          status: ro.status,
          lastUpdated: new Date(ro.updated_at || ro.created_at).toLocaleDateString(),
          reportStatus: report?.status || null,
          greenCount: counts.green,
          yellowCount: counts.yellow,
          redCount: counts.red,
        };
      });
  }, [repairOrders, reports, reportItemCounts, search]);

  const openQueueItems = useMemo(
    () => queueItems.filter((item) => item.status !== 'inspection_complete' && item.status !== 'closed'),
    [queueItems]
  );

  const inspectionCompleteItems = useMemo(
    () => queueItems.filter((item) => item.status === 'inspection_complete'),
    [queueItems]
  );

  const pastQueueItems = useMemo(
    () => queueItems.filter((item) => item.status === 'closed'),
    [queueItems]
  );

  const selectedItem = useMemo(
    () => reportItems.find((item) => item.id === selectedItemId) || null,
    [reportItems, selectedItemId]
  );

  if (!admin) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-[1400px] mx-auto px-4 py-6 space-y-6">
        <header className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Technician workspace</p>
              <h1 className="text-3xl font-bold text-slate-900">Digital inspection workflow</h1>
              <p className="text-sm text-slate-500 mt-2">Move fast from RO queue to checklist to publish.</p>
            </div>
            <button
              onClick={signOut}
              className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign Out
            </button>
          </div>
        </header>

        {message && (
          <div
            className={`p-4 rounded-lg text-sm font-medium ${
              message.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
          <div className="space-y-4">
            <TechnicianRoQueue
              items={openQueueItems}
              selectedId={selectedRoId}
              search={search}
              onSearchChange={setSearch}
              filter="open"
              onFilterChange={() => {}}
              onSelect={(id) => {
                setSelectedRoId(id);
                setSelectedItemId(null);
                const existingReport = reports.find((report) => report.repair_order_id === id) || null;
                if (existingReport) {
                  setSelectedReportId(existingReport.id);
                  setDrawerOpen(true);
                } else {
                  createReportForOrder(id);
                }
              }}
              loading={loading}
              title="Open inspections"
              subtitle="Repair Order Queue"
              showFilters={false}
              emptyMessage="No open inspections right now."
            />

            <TechnicianRoQueue
              items={inspectionCompleteItems}
              selectedId={selectedRoId}
              search={search}
              onSearchChange={setSearch}
              filter="published"
              onFilterChange={() => {}}
              onSelect={(id) => {
                setSelectedRoId(id);
                setSelectedItemId(null);
                const existingReport = reports.find((report) => report.repair_order_id === id) || null;
                if (existingReport) {
                  setSelectedReportId(existingReport.id);
                  setDrawerOpen(true);
                }
              }}
              loading={loading}
              title="Inspection complete"
              subtitle="Ready for review"
              showFilters={false}
              emptyMessage="No inspections completed yet."
            />

            <TechnicianRoQueue
              items={pastQueueItems}
              selectedId={selectedRoId}
              search={search}
              onSearchChange={setSearch}
              filter="published"
              onFilterChange={() => {}}
              onSelect={(id) => {
                setSelectedRoId(id);
                setSelectedItemId(null);
                const existingReport = reports.find((report) => report.repair_order_id === id) || null;
                if (existingReport) {
                  setSelectedReportId(existingReport.id);
                  setDrawerOpen(true);
                }
              }}
              loading={loading}
              title="Past inspections"
              subtitle="Closed repair orders"
              showFilters={false}
              emptyMessage="No past inspections yet."
            />
          </div>

          <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Inspection checklist</h2>
                <p className="text-xs text-slate-500">Tap an item to add notes and media.</p>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700">{totals.green} green</span>
                <span className="px-2 py-1 rounded-full bg-amber-50 text-amber-700">{totals.yellow} yellow</span>
                <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700">{totals.red} red</span>
              </div>
            </div>

            {!selectedReport && (
              <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
                Select a repair order to start an inspection.
              </div>
            )}

            {selectedReport && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 border border-slate-200 rounded-xl p-3 sticky top-4 z-10 backdrop-blur">
                  <div className="text-sm">
                    <div className="font-semibold text-slate-900">RO #{selectedReport.repair_order_id.slice(0, 8)}</div>
                    <div className="text-xs text-slate-500">Template: {selectedTemplate?.name || 'Default'}</div>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg"
                      onClick={() => {
                        setSelectedItemId(null);
                        setDrawerOpen(true);
                      }}
                    >
                      <ListChecks className="w-4 h-4" />
                      Summary
                    </button>
                    <button
                      onClick={handleMarkInspectionComplete}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg"
                      disabled={!selectedReport}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark Complete
                    </button>
                    <button
                      onClick={flushAllUpdates}
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg"
                      disabled={saving}
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Save Draft
                    </button>
                    <button
                      onClick={() => setPublishConfirm(true)}
                      className="flex items-center gap-2 px-3 py-2 text-white rounded-lg"
                      style={{ backgroundColor: brandSettings.primary_color }}
                      disabled={reportItems.length === 0}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Publish
                    </button>
                    <button
                      className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg"
                      onClick={() => showMessage('success', 'Customer notified')}
                    >
                      <Send className="w-4 h-4" />
                      Notify
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 border border-slate-200 rounded-xl p-3">
                  <input
                    value={globalSection}
                    onChange={(event) => setGlobalSection(event.target.value)}
                    placeholder="Section"
                    className="w-full sm:w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <input
                    value={globalItemTitle}
                    onChange={(event) => setGlobalItemTitle(event.target.value)}
                    placeholder="Quick add item"
                    className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                  />
                  <button
                    onClick={handleGlobalQuickAdd}
                    className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Add
                  </button>
                </div>

                <div className="space-y-4">
                  {checklistSections.map((section) => (
                    <div key={section.id} className="border border-slate-200 rounded-2xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-slate-900">{section.title}</h3>
                          <div className="text-xs text-slate-500">
                            {section.items.length} items · {section.greenCount} green · {section.yellowCount} yellow · {section.redCount} red
                          </div>
                        </div>
                        <SlidersHorizontal className="w-4 h-4 text-slate-400" />
                      </div>

                      <div className="grid grid-cols-1 gap-2">
                        {section.items.map((item) => (
                          <button
                            key={item.id}
                            onClick={() => {
                              setSelectedItemId(item.id);
                              setDrawerOpen(true);
                            }}
                            className={`flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition ${
                              selectedItemId === item.id ? 'border-slate-400 bg-slate-50' : 'border-slate-200'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-slate-900">{item.title}</span>
                                {item.isCustom && (
                                  <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Custom</span>
                                )}
                              </div>
                              <div className="text-xs text-slate-500">
                                {item.recommendation_status ? `Recommendation: ${item.recommendation_status}` : 'No recommendation'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 text-xs rounded-full ${item.condition === 'green' ? 'bg-emerald-100 text-emerald-700' : item.condition === 'yellow' ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                {item.condition.toUpperCase()}
                              </span>
                              <span className="text-xs text-slate-400">
                                {reportMedia.filter((media) => media.report_item_id === item.id).length} media
                              </span>
                            </div>
                          </button>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <input
                          value={quickAdd[section.id] || ''}
                          onChange={(event) => setQuickAdd((prev) => ({ ...prev, [section.id]: event.target.value }))}
                          placeholder="Quick add item"
                          className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm"
                          autoComplete="off"
                        />
                        <button
                          onClick={() => handleAddCustomItem(section.id)}
                          className="flex items-center gap-2 px-3 py-2 border border-slate-300 rounded-lg text-sm"
                        >
                          <Plus className="w-4 h-4" />
                          Add
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <ItemDetailDrawer
        open={drawerOpen && Boolean(selectedReportId)}
        item={selectedItem}
        itemTitle={selectedItem?.custom_title || selectedItem?.recommendation || 'Inspection item'}
        sectionTitle={selectedItem?.custom_section || null}
        media={itemMedia}
        reportMedia={reportMediaAttachments}
        redCount={totals.red}
        yellowCount={totals.yellow}
        greenCount={totals.green}
        onClose={() => {
          setSelectedItemId(null);
          setDrawerOpen(false);
        }}
        onUpdateItem={(updates) => {
          if (!selectedItem) return;
          queueItemUpdate(selectedItem.id, updates);
        }}
        onUploadItemMedia={(file, mediaType) => {
          if (!selectedItem) return;
          uploadItemMedia(selectedItem.id, file, mediaType);
        }}
        onDeleteItemMedia={deleteItemMedia}
        onUploadReportMedia={uploadReportMedia}
        onDeleteReportMedia={deleteReportMedia}
      />

      {publishConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3">
              <ListChecks className="w-6 h-6 text-emerald-500" />
              <h3 className="text-lg font-semibold text-slate-900">Publish inspection?</h3>
            </div>
            <p className="text-sm text-slate-600">
              This will publish the inspection to the customer and lock the current findings.
            </p>
            <div className="flex gap-2 text-xs">
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700">{totals.green} green</span>
              <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-700">{totals.yellow} yellow</span>
              <span className="px-3 py-1 rounded-full bg-rose-50 text-rose-700">{totals.red} red</span>
            </div>
            <div className="flex justify-end gap-2">
              <button
                className="px-4 py-2 border border-slate-300 rounded-lg text-sm"
                onClick={() => setPublishConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 text-white rounded-lg text-sm"
                style={{ backgroundColor: brandSettings.primary_color }}
                onClick={handlePublish}
              >
                Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReportId && !drawerOpen && (
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-lg"
        >
          <ListChecks className="h-4 w-4" />
          Open panel
        </button>
      )}
    </div>
  );
}

