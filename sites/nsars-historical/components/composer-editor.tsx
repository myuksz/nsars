"use client";

/* eslint-disable @next/next/no-img-element -- Preview media must retain the protected preview URL and session boundary. */

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type FormEvent,
} from "react";
import {
  changeComposerPageType,
  cloneComposerPageDocument,
  createComposerPageBlock,
  reindexComposerBlocks,
  type ComposerBlock,
  type ComposerBlockLayout,
  type ComposerPageDocument,
  type ComposerResponsive,
} from "@/lib/composer-contract";
import {
  BLOCK_REGISTRY,
  PAGE_TYPE_REGISTRY,
  blockDefinitionByType,
  pageTypeById,
  variantsForPageType,
  type BlockFieldDefinition,
  type BlockType,
  type ContentPageTypeId,
} from "@/lib/composer-registry";
import { stableStringify } from "@/lib/page-contract";
import type { MediaItem } from "@/lib/media-contract";
import type { AdminPageOption, AdminSnapshot } from "@/lib/site-store";
import {
  ComposerBlockView,
  projectRenderableMedia,
} from "@/components/composer-page-renderer";

type ComposerEditorProps = {
  initialSnapshot: AdminSnapshot;
  initialMedia: MediaItem[];
  actorLabel: string;
  pageOptions: AdminPageOption[];
};

type ApiPayload = {
  ok?: boolean;
  snapshot?: AdminSnapshot;
  pages?: AdminPageOption[];
  notice?: string;
  error?: string;
  details?: string[];
};

const CONTENT_TYPES = PAGE_TYPE_REGISTRY.filter(
  (entry) => entry.nodeKind === "CONTENT",
);

export function ComposerEditor({
  initialSnapshot,
  initialMedia,
  actorLabel,
  pageOptions: initialPageOptions,
}: ComposerEditorProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [document, setDocument] = useState(() =>
    cloneComposerPageDocument(initialSnapshot.draft),
  );
  const [baseline, setBaseline] = useState(() =>
    stableStringify(initialSnapshot.draft),
  );
  const [pageOptions, setPageOptions] = useState(initialPageOptions);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(
    initialSnapshot.draft.blocks[0]?.blockId ?? null,
  );
  const [insertionIndex, setInsertionIndex] = useState(
    initialSnapshot.draft.blocks.length,
  );
  const [sideMode, setSideMode] = useState<"inspector" | "library">(
    initialSnapshot.draft.blocks.length ? "inspector" : "library",
  );
  const [viewport, setViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState(
    "Конструктор готов. Любой блок можно добавить в любое место.",
  );
  const [error, setError] = useState<string | null>(null);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [past, setPast] = useState<ComposerPageDocument[]>([]);
  const [future, setFuture] = useState<ComposerPageDocument[]>([]);
  const [createMode, setCreateMode] = useState<"create" | "duplicate" | null>(null);

  const dirty = useMemo(
    () => stableStringify(document) !== baseline,
    [document, baseline],
  );
  const selectedBlock = document.blocks.find(
    (block) => block.blockId === selectedBlockId,
  ) ?? null;
  const renderableMedia = useMemo(
    () => projectRenderableMedia(initialMedia, "preview"),
    [initialMedia],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function commit(updater: (current: ComposerPageDocument) => ComposerPageDocument) {
    setDocument((current) => {
      const next = updater(cloneComposerPageDocument(current));
      setPast((items) => [...items.slice(-49), current]);
      setFuture([]);
      return next;
    });
  }

  function undo() {
    const previous = past.at(-1);
    if (!previous) return;
    setFuture((items) => [document, ...items].slice(0, 50));
    setPast((items) => items.slice(0, -1));
    setDocument(cloneComposerPageDocument(previous));
  }

  function redo() {
    const next = future[0];
    if (!next) return;
    setPast((items) => [...items.slice(-49), document]);
    setFuture((items) => items.slice(1));
    setDocument(cloneComposerPageDocument(next));
  }

  function insertBlock(type: BlockType, variantId?: string) {
    commit((current) => {
      const next = [...current.blocks];
      const index = Math.min(Math.max(0, insertionIndex), next.length);
      const block = createComposerPageBlock(type, index, variantId);
      next.splice(index, 0, block);
      current.blocks = reindexComposerBlocks(next);
      setSelectedBlockId(block.blockId);
      setInsertionIndex(index + 1);
      setSideMode("inspector");
      return current;
    });
  }

  function moveBlock(blockId: string, toIndex: number) {
    commit((current) => {
      const from = current.blocks.findIndex((block) => block.blockId === blockId);
      if (from < 0) return current;
      const next = [...current.blocks];
      const [block] = next.splice(from, 1);
      const target = Math.max(0, Math.min(toIndex > from ? toIndex - 1 : toIndex, next.length));
      next.splice(target, 0, block);
      current.blocks = reindexComposerBlocks(next);
      return current;
    });
  }

  function duplicateBlock(blockId: string) {
    commit((current) => {
      const index = current.blocks.findIndex((block) => block.blockId === blockId);
      if (index < 0) return current;
      const duplicate = cloneBlockForEditor(current.blocks[index]);
      const next = [...current.blocks];
      next.splice(index + 1, 0, duplicate);
      current.blocks = reindexComposerBlocks(next);
      setSelectedBlockId(duplicate.blockId);
      return current;
    });
  }

  function deleteBlock(blockId: string) {
    if (!window.confirm("Удалить этот блок из черновика?")) return;
    commit((current) => {
      current.blocks = reindexComposerBlocks(
        current.blocks.filter((block) => block.blockId !== blockId),
      );
      setSelectedBlockId(null);
      setSideMode("library");
      return current;
    });
  }

  function patchSelectedBlock(next: Partial<ComposerBlock>) {
    if (!selectedBlockId) return;
    commit((current) => {
      current.blocks = current.blocks.map((block) =>
        block.blockId === selectedBlockId ? { ...block, ...next } : block,
      );
      return current;
    });
  }

  function patchSelectedData(key: string, value: unknown) {
    if (!selectedBlock) return;
    if (selectedBlock.type === "F20" && key === "columns") {
      const columns = Math.min(4, Math.max(1, Math.round(Number(value) || 1)));
      const currentSlots = Array.isArray(selectedBlock.data.slots)
        ? selectedBlock.data.slots.filter(isRecord)
        : [];
      const removedSlotsContainBlocks = currentSlots.slice(columns).some(
        (slot) => Array.isArray(slot.blocks) && slot.blocks.length > 0,
      );
      if (removedSlotsContainBlocks) {
        setError(
          "Сначала перенесите или удалите блоки из убираемых колонок — конструктор не удаляет их автоматически.",
        );
        return;
      }
      const slots = Array.from({ length: columns }, (_, index) =>
        currentSlots[index] ?? {
          slotId: `slot_${crypto.randomUUID().replaceAll("-", "")}`,
          label: `Колонка ${index + 1}`,
          blocks: [],
        },
      );
      patchSelectedBlock({ data: { ...selectedBlock.data, columns, slots } });
      return;
    }
    patchSelectedBlock({ data: { ...selectedBlock.data, [key]: value } });
  }

  function changePageType(pageType: ContentPageTypeId) {
    if (pageType === document.pageType) return;
    const next = changeComposerPageType(document, pageType);
    const moved = next.quarantinedBlocks.length - document.quarantinedBlocks.length;
    if (moved > 0 && !window.confirm(`${moved} специализированных блоков будут временно убраны в карантин. Продолжить?`)) return;
    commit(() => next);
    setSelectedBlockId(next.blocks[0]?.blockId ?? null);
  }

  async function saveDraft() {
    await run("save", "/api/admin/page/", "PUT", {
      document,
      expectedDraftVersion: snapshot.draftVersion,
    }, true);
  }

  async function publish() {
    if (dirty) {
      setError("Сначала сохраните черновик, затем публикуйте.");
      return;
    }
    await run("publish", "/api/admin/publish/", "POST", {
      pageId: document.pageId,
      expectedDraftVersion: snapshot.draftVersion,
    });
  }

  async function toggleVisibility() {
    if (dirty) {
      setError("Сначала сохраните черновик.");
      return;
    }
    await run("visibility", "/api/admin/visibility/", "POST", {
      pageId: document.pageId,
      visible: !snapshot.publicVisible,
    });
  }

  async function rollback(revisionId: string) {
    if (!window.confirm("Сделать эту опубликованную ревизию активной? Черновик не изменится.")) return;
    await run("rollback", "/api/admin/rollback/", "POST", {
      pageId: document.pageId,
      targetRevisionId: revisionId,
      expectedActiveRevisionId: snapshot.activeRevisionId,
    });
  }

  async function run(
    key: string,
    endpoint: string,
    method: "PUT" | "POST",
    body: Record<string, unknown>,
    replaceDraft = false,
  ) {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = await response.json() as ApiPayload;
      if (!response.ok || !payload.snapshot) throw payloadError(payload, "Операция не выполнена.");
      setSnapshot(payload.snapshot);
      if (replaceDraft) {
        const next = cloneComposerPageDocument(payload.snapshot.draft);
        setDocument(next);
        setBaseline(stableStringify(next));
        setPast([]);
        setFuture([]);
      }
      setNotice(payload.notice ?? "Готово.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Неизвестная ошибка.");
    } finally {
      setBusy(null);
    }
  }

  function navigateToPage(pageId: string) {
    if (pageId === document.pageId) return;
    if (dirty && !window.confirm("Есть несохранённые изменения. Перейти без сохранения?")) return;
    window.location.assign(`/admin/pages/${encodeURIComponent(pageId)}/`);
  }

  return (
    <div className="composer-admin-shell">
      <header className="composer-admin-topbar">
        <div><p className="admin-kicker">NS—ARS / МОСКВА</p><h1>Конструктор страниц</h1></div>
        <div className="composer-top-actions">
          <span className="admin-actor">{actorLabel}</span>
          <Link href="/admin/menu/">Меню</Link>
          <Link href="/admin/media/">Медиатека</Link>
          <a href={`/preview/?page=${encodeURIComponent(document.pageId)}`} target="_blank" rel="noreferrer">Предпросмотр</a>
          <form action="/api/admin/auth/logout/" method="post"><button type="submit">Выйти</button></form>
        </div>
      </header>
      <div className="composer-commandbar">
        <button type="button" onClick={undo} disabled={!past.length}>Отменить</button>
        <button type="button" onClick={redo} disabled={!future.length}>Повторить</button>
        <div className="composer-viewport-switch" role="group" aria-label="Размер предпросмотра">
          {(["desktop", "tablet", "mobile"] as const).map((value) => <button type="button" className={viewport === value ? "is-active" : ""} onClick={() => setViewport(value)} key={value}>{value === "desktop" ? "Компьютер" : value === "tablet" ? "Планшет" : "Телефон"}</button>)}
        </div>
        <span className={`composer-dirty ${dirty ? "is-dirty" : ""}`}>{dirty ? "Есть несохранённые изменения" : `Черновик v${snapshot.draftVersion} сохранён`}</span>
        <button className="admin-primary" type="button" disabled={busy !== null || !dirty} onClick={saveDraft}>{busy === "save" ? "Сохраняю…" : "Сохранить"}</button>
        <button type="button" disabled={busy !== null || dirty} onClick={publish}>{busy === "publish" ? "Публикую…" : "Опубликовать"}</button>
        <button type="button" disabled={busy !== null || dirty || (!snapshot.activeRevisionId && !snapshot.publicVisible)} onClick={toggleVisibility}>{snapshot.publicVisible ? "Скрыть" : "Открыть"}</button>
      </div>
      <div className="composer-message" aria-live="polite">{error ? <p className="is-error">{error}</p> : <p>{notice}</p>}</div>

      <div className="composer-workspace">
        <aside className="composer-page-tree" aria-label="Страницы сайта">
          <div className="composer-panel-heading"><div><span>СТРУКТУРА</span><h2>Страницы</h2></div><button type="button" onClick={() => setCreateMode("create")}>+ Новая</button></div>
          <button className="composer-duplicate-page" type="button" onClick={() => setCreateMode("duplicate")}>Дублировать текущую</button>
          <ol>{pageOptions.map((page) => <li key={page.pageId}><button type="button" className={page.pageId === document.pageId ? "is-current" : ""} onClick={() => navigateToPage(page.pageId)}><strong>{page.label}</strong><span>{pageTypeById[page.pageType].shortName} · {page.blockCount} блоков</span><small>{page.publicVisible ? "Открыта" : "Скрыта"}{page.hasPublished ? " · есть публикация" : ""}</small></button></li>)}</ol>
          <div className="composer-revisions"><h3>Публикации</h3>{snapshot.revisions.length ? <ol>{snapshot.revisions.map((revision) => <li key={revision.id}><span>№ {revision.revisionNo}{revision.active ? " · активна" : ""}</span>{!revision.active ? <button type="button" onClick={() => rollback(revision.id)} disabled={busy !== null}>Вернуть</button> : null}</li>)}</ol> : <p>Пока нет опубликованных ревизий.</p>}</div>
        </aside>

        <section className="composer-canvas-panel">
          <header className="composer-document-header">
            <div><span>{pageTypeById[document.pageType].name}</span><h2>{document.title}</h2><code>{document.route}</code></div>
            <button type="button" onClick={() => { setSelectedBlockId(null); setSideMode("inspector"); }}>Настройки страницы</button>
          </header>
          <div className={`composer-editor-viewport is-${viewport}`}>
            <DropZone index={0} active={insertionIndex === 0} onInsert={() => { setInsertionIndex(0); setSideMode("library"); }} onDrop={(event) => handleDrop(event, 0, draggedBlockId, moveBlock)} />
            {document.blocks.length ? document.blocks.map((block, index) => (
              <div className={`composer-canvas-block ${selectedBlockId === block.blockId ? "is-selected" : ""} ${block.hidden ? "is-hidden" : ""}`} key={block.blockId} draggable onDragStart={() => setDraggedBlockId(block.blockId)} onDragEnd={() => setDraggedBlockId(null)}>
                <div className="composer-block-toolbar">
                  <button type="button" onClick={() => { setSelectedBlockId(block.blockId); setSideMode("inspector"); }}><strong>{blockDefinitionByType[block.type].name}</strong><span>{block.type}{block.variantId ? ` · ${block.variantId}` : ""}</span></button>
                  <div>
                    <button type="button" aria-label="Переместить выше" disabled={index === 0} onClick={() => moveBlock(block.blockId, index - 1)}>↑</button>
                    <button type="button" aria-label="Переместить ниже" disabled={index === document.blocks.length - 1} onClick={() => moveBlock(block.blockId, index + 2)}>↓</button>
                    <button type="button" onClick={() => duplicateBlock(block.blockId)}>Копия</button>
                    <button type="button" onClick={() => toggleBlockHidden(block, commit)}>{block.hidden ? "Показать" : "Скрыть"}</button>
                    <button type="button" onClick={() => deleteBlock(block.blockId)}>Удалить</button>
                  </div>
                </div>
                <div className="composer-block-surface" onClick={() => { setSelectedBlockId(block.blockId); setSideMode("inspector"); }}>
                  {block.hidden ? <span className="composer-hidden-label">Блок скрыт на публичной странице</span> : <ComposerBlockView block={block} mediaItems={renderableMedia} mode="preview" pageId={document.pageId} editor />}
                </div>
                <DropZone index={index + 1} active={insertionIndex === index + 1} onInsert={() => { setInsertionIndex(index + 1); setSideMode("library"); }} onDrop={(event) => handleDrop(event, index + 1, draggedBlockId, moveBlock)} />
              </div>
            )) : <button className="composer-empty-canvas" type="button" onClick={() => { setInsertionIndex(0); setSideMode("library"); }}><strong>Пустая страница</strong><span>Добавьте первый блок — обязательного скелета нет.</span></button>}
          </div>
        </section>

        <aside className="composer-side-panel">
          <div className="composer-side-tabs" role="tablist"><button type="button" role="tab" aria-selected={sideMode === "inspector"} className={sideMode === "inspector" ? "is-active" : ""} onClick={() => setSideMode("inspector")}>Настройки</button><button type="button" role="tab" aria-selected={sideMode === "library"} className={sideMode === "library" ? "is-active" : ""} onClick={() => setSideMode("library")}>Добавить блок</button></div>
          {sideMode === "library" ? <BlockLibrary pageType={document.pageType} insertionIndex={insertionIndex} onInsert={insertBlock} /> : selectedBlock ? <BlockInspector block={selectedBlock} pageType={document.pageType} media={initialMedia} onData={patchSelectedData} onPatch={patchSelectedBlock} /> : <PageInspector document={document} quarantinedCount={document.quarantinedBlocks.length} onPatch={(patch) => commit((current) => ({ ...current, ...patch }))} onType={changePageType} />}
        </aside>
      </div>
      {createMode ? <CreatePageDialog mode={createMode} sourcePageId={document.pageId} onClose={() => setCreateMode(null)} onCreated={(payload) => { if (payload.pages) setPageOptions(payload.pages); if (payload.snapshot) window.location.assign(`/admin/pages/${encodeURIComponent(payload.snapshot.draft.pageId)}/`); }} /> : null}
    </div>
  );
}

function DropZone({ index, active, onInsert, onDrop }: { index: number; active: boolean; onInsert: () => void; onDrop: (event: DragEvent<HTMLDivElement>) => void }) {
  return <div className={`composer-drop-zone ${active ? "is-active" : ""}`} onDragOver={(event) => event.preventDefault()} onDrop={onDrop}><button type="button" onClick={onInsert}>+ Добавить здесь <span>{index + 1}</span></button></div>;
}

function BlockLibrary({ pageType, insertionIndex, onInsert }: { pageType: ContentPageTypeId; insertionIndex: number; onInsert: (type: BlockType, variantId?: string) => void }) {
  const variants = variantsForPageType(pageType);
  const groups = [...new Set(BLOCK_REGISTRY.map((item) => item.group))];
  return <div className="composer-library"><header><span>ПОЗИЦИЯ {insertionIndex + 1}</span><h2>Библиотека блоков</h2><p>Все 21 семейство доступны на любой контентной странице. Специальные варианты показаны только для выбранного типа.</p></header>{variants.length ? <section><h3>Для типа «{pageTypeById[pageType].shortName}»</h3><div>{variants.map((variant) => <button type="button" onClick={() => onInsert(variant.blockType, variant.id)} key={variant.id}><strong>{variant.name}</strong><span>{variant.description}</span></button>)}</div></section> : null}{groups.map((group) => <section key={group}><h3>{group}</h3><div>{BLOCK_REGISTRY.filter((item) => item.group === group).map((item) => <button type="button" onClick={() => onInsert(item.type)} key={item.type}><strong>{item.type} · {item.name}</strong><span>{item.description}</span></button>)}</div></section>)}</div>;
}

function BlockInspector({ block, pageType, media, onData, onPatch }: { block: ComposerBlock; pageType: ContentPageTypeId; media: MediaItem[]; onData: (key: string, value: unknown) => void; onPatch: (patch: Partial<ComposerBlock>) => void }) {
  const definition = blockDefinitionByType[block.type];
  return <div className="composer-inspector"><header><span>{block.type}</span><h2>{definition.name}</h2><p>{definition.description}</p></header><section><h3>Содержимое</h3>{definition.fields.map((field) => <RegistryField field={field} value={block.data[field.key]} media={media} defaultValue={(definition.defaultData as Record<string, unknown>)[field.key]} onChange={(value) => onData(field.key, value)} key={field.key} />)}{block.type === "F18" ? <PhotoWindowsEditor value={block.data.photoWindows} onChange={(value) => onData("photoWindows", value)} /> : null}{block.type === "F20" ? <StructuralRowEditor value={block.data.slots} pageType={pageType} media={media} onChange={(value) => onData("slots", value)} /> : null}</section><section><h3>Расположение</h3><SelectField label="Ширина" value={block.layout.width} options={["narrow", "standard", "wide", "full"]} onChange={(value) => onPatch({ layout: { ...block.layout, width: value as ComposerBlockLayout["width"] } })} /><SelectField label="Выравнивание" value={block.layout.align} options={["left", "center", "right"]} onChange={(value) => onPatch({ layout: { ...block.layout, align: value as ComposerBlockLayout["align"] } })} /><SelectField label="Палитра" value={block.layout.tone} options={["paper", "ink", "petrol", "ochre", "red", "cobalt"]} onChange={(value) => onPatch({ layout: { ...block.layout, tone: value as ComposerBlockLayout["tone"] } })} /><SelectField label="Отступ сверху" value={block.layout.spacingTop} options={["none", "s", "m", "l", "xl"]} onChange={(value) => onPatch({ layout: { ...block.layout, spacingTop: value as ComposerBlockLayout["spacingTop"] } })} /><SelectField label="Отступ снизу" value={block.layout.spacingBottom} options={["none", "s", "m", "l", "xl"]} onChange={(value) => onPatch({ layout: { ...block.layout, spacingBottom: value as ComposerBlockLayout["spacingBottom"] } })} /><CheckField label="На всю ширину" checked={block.layout.fullBleed} onChange={(value) => onPatch({ layout: { ...block.layout, fullBleed: value } })} /></section><section><h3>Адаптивность</h3><CheckField label="Скрыть на компьютере" checked={block.responsive.hideDesktop} onChange={(value) => onPatch({ responsive: { ...block.responsive, hideDesktop: value } })} /><CheckField label="Скрыть на планшете" checked={block.responsive.hideTablet} onChange={(value) => onPatch({ responsive: { ...block.responsive, hideTablet: value } })} /><CheckField label="Скрыть на телефоне" checked={block.responsive.hideMobile} onChange={(value) => onPatch({ responsive: { ...block.responsive, hideMobile: value } })} /><SelectField label="Выравнивание на телефоне" value={block.responsive.mobileAlign} options={["inherit", "left", "center", "right"]} onChange={(value) => onPatch({ responsive: { ...block.responsive, mobileAlign: value as ComposerResponsive["mobileAlign"] } })} /></section></div>;
}

function RegistryField({ field, value, defaultValue, media, onChange }: { field: BlockFieldDefinition; value: unknown; defaultValue: unknown; media: MediaItem[]; onChange: (value: unknown) => void }) {
  if (field.kind === "toggle") return <CheckField label={field.label} checked={Boolean(value)} onChange={onChange} />;
  if (field.kind === "select") return <label className="composer-field"><span>{field.label}</span><select value={String(value ?? "")} onChange={(event) => onChange(event.target.value)}>{field.options?.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}</select>{field.help ? <small>{field.help}</small> : null}</label>;
  if (field.kind === "number") return <label className="composer-field"><span>{field.label}</span><input type="number" value={typeof value === "number" ? value : 0} onChange={(event) => onChange(Number(event.target.value))} />{field.help ? <small>{field.help}</small> : null}</label>;
  if (field.kind === "list") return <label className="composer-field"><span>{field.label}</span><textarea rows={7} value={Array.isArray(value) ? value.join("\n") : ""} onChange={(event) => onChange(event.target.value.split("\n"))} />{field.help ? <small>{field.help}</small> : null}</label>;
  if (field.kind === "media") {
    const single = defaultValue === null;
    const selected = new Set(Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : typeof value === "string" ? [value] : []);
    return <fieldset className="composer-media-field"><legend>{field.label}</legend>{media.length ? media.map((item) => <label key={item.id}><input type={single ? "radio" : "checkbox"} name={single ? field.key : undefined} checked={selected.has(item.id)} onChange={() => single ? onChange(selected.has(item.id) ? null : item.id) : onChange(selected.has(item.id) ? [...selected].filter((id) => id !== item.id) : [...selected, item.id])} /><img src={`/api/media/${encodeURIComponent(item.id)}/?preview=1`} alt="" /><span>{item.name}</span></label>) : <p>Медиатека пуста. Сначала загрузите изображения в разделе «Медиатека».</p>}</fieldset>;
  }
  const multiline = field.kind === "textarea";
  return <label className="composer-field"><span>{field.label}</span>{multiline ? <textarea rows={5} value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} /> : <input value={typeof value === "string" ? value : ""} onChange={(event) => onChange(event.target.value)} />}{field.help ? <small>{field.help}</small> : null}</label>;
}

type StructuralSlot = {
  slotId: string;
  label: string;
  blocks: ComposerBlock[];
};

function StructuralRowEditor({ value, pageType, media, onChange }: { value: unknown; pageType: ContentPageTypeId; media: MediaItem[]; onChange: (value: StructuralSlot[]) => void }) {
  const slots = Array.isArray(value) ? value.flatMap((slot) => {
    if (!isRecord(slot) || typeof slot.slotId !== "string" || typeof slot.label !== "string" || !Array.isArray(slot.blocks)) return [];
    return [{ slotId: slot.slotId, label: slot.label, blocks: slot.blocks.filter(isComposerBlock) }];
  }) : [];
  const allowedBlocks = BLOCK_REGISTRY.filter((entry) => entry.type !== "F20");

  function updateSlot(index: number, updater: (slot: StructuralSlot) => StructuralSlot) {
    onChange(slots.map((slot, slotIndex) => slotIndex === index ? updater(structuredClone(slot)) : slot));
  }

  function addNested(slotIndex: number, type: BlockType) {
    updateSlot(slotIndex, (slot) => {
      slot.blocks = reindexComposerBlocks([
        ...slot.blocks,
        createComposerPageBlock(type, slot.blocks.length),
      ]);
      return slot;
    });
  }

  function updateNested(slotIndex: number, blockIndex: number, updater: (block: ComposerBlock) => ComposerBlock) {
    updateSlot(slotIndex, (slot) => {
      slot.blocks = slot.blocks.map((block, index) => index === blockIndex ? updater(structuredClone(block)) : block);
      return slot;
    });
  }

  function moveNested(slotIndex: number, blockIndex: number, direction: -1 | 1) {
    updateSlot(slotIndex, (slot) => {
      const target = blockIndex + direction;
      if (target < 0 || target >= slot.blocks.length) return slot;
      const blocks = [...slot.blocks];
      [blocks[blockIndex], blocks[target]] = [blocks[target], blocks[blockIndex]];
      slot.blocks = reindexComposerBlocks(blocks);
      return slot;
    });
  }

  return <div className="composer-structural-editor"><h4>Колонки с блоками</h4><p>Один уровень вложенности · тип страницы «{pageTypeById[pageType].shortName}».</p>{slots.map((slot, slotIndex) => <fieldset key={slot.slotId}><legend>{slot.label}</legend><label className="composer-field"><span>Название колонки</span><input value={slot.label} onChange={(event) => updateSlot(slotIndex, (current) => ({ ...current, label: event.target.value }))} /></label>{slot.blocks.map((nested, blockIndex) => { const definition = blockDefinitionByType[nested.type]; return <details className="composer-nested-block" key={nested.blockId}><summary>{nested.type} · {definition.name}</summary><div className="composer-nested-actions"><button type="button" disabled={blockIndex === 0} onClick={() => moveNested(slotIndex, blockIndex, -1)}>↑</button><button type="button" disabled={blockIndex === slot.blocks.length - 1} onClick={() => moveNested(slotIndex, blockIndex, 1)}>↓</button><button type="button" onClick={() => updateSlot(slotIndex, (current) => ({ ...current, blocks: reindexComposerBlocks(current.blocks.filter((_, index) => index !== blockIndex)) }))}>Удалить</button></div>{definition.fields.map((field) => <RegistryField key={field.key} field={field} value={nested.data[field.key]} defaultValue={(definition.defaultData as Record<string, unknown>)[field.key]} media={media} onChange={(fieldValue) => updateNested(slotIndex, blockIndex, (current) => ({ ...current, data: { ...current.data, [field.key]: fieldValue } }))} />)}<SelectField label="Ширина" value={nested.layout.width} options={["narrow", "standard", "wide", "full"]} onChange={(fieldValue) => updateNested(slotIndex, blockIndex, (current) => ({ ...current, layout: { ...current.layout, width: fieldValue as ComposerBlockLayout["width"] } }))} /></details>; })}<label className="composer-field"><span>Добавить блок в колонку</span><select value="" onChange={(event) => { const type = event.target.value as BlockType; if (type) addNested(slotIndex, type); }}><option value="">Выберите семейство</option>{allowedBlocks.map((entry) => <option value={entry.type} key={entry.type}>{entry.type} · {entry.name}</option>)}</select></label></fieldset>)}</div>;
}

function PhotoWindowsEditor({ value, onChange }: { value: unknown; onChange: (value: unknown[]) => void }) {
  const windows = Array.isArray(value) ? value.filter(isRecord) : [];
  return <div className="composer-window-editor"><h4>Фотоокна</h4>{windows.map((windowValue, index) => <div key={String(windowValue.windowId ?? index)}><input value={String(windowValue.label ?? `Фотозона ${index + 1}`)} onChange={(event) => onChange(windows.map((item, itemIndex) => itemIndex === index ? { ...item, label: event.target.value } : item))} /><button type="button" onClick={() => onChange(windows.filter((_, itemIndex) => itemIndex !== index))}>Удалить окно</button></div>)}<button type="button" disabled={windows.length >= 4} onClick={() => onChange([...windows, { windowId: `window_${crypto.randomUUID().replaceAll("-", "")}`, label: `Фотозона ${windows.length + 1}`, mediaIds: [], quad: [{ x: 0.08, y: 0.12 }, { x: 0.48, y: 0.12 }, { x: 0.48, y: 0.72 }, { x: 0.08, y: 0.72 }] }])}>+ Фотоокно</button></div>;
}

function PageInspector({ document, quarantinedCount, onPatch, onType }: { document: ComposerPageDocument; quarantinedCount: number; onPatch: (patch: Partial<ComposerPageDocument>) => void; onType: (value: ContentPageTypeId) => void }) {
  return <div className="composer-inspector"><header><span>СТРАНИЦА</span><h2>Общие настройки</h2></header><section><label className="composer-field"><span>Название</span><input value={document.title} maxLength={120} onChange={(event) => onPatch({ title: event.target.value })} /></label><label className="composer-field"><span>Тип страницы</span><select value={document.pageType} onChange={(event) => onType(event.target.value as ContentPageTypeId)}>{CONTENT_TYPES.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select><small>{pageTypeById[document.pageType].description}</small></label><label className="composer-field"><span>Адрес</span><input value={document.route} readOnly /><small>Адрес меняется отдельной безопасной операцией, чтобы не сломать ссылки.</small></label></section><section><h3>SEO</h3><label className="composer-field"><span>Заголовок поисковой выдачи</span><input value={document.seo.title} onChange={(event) => onPatch({ seo: { ...document.seo, title: event.target.value } })} /></label><label className="composer-field"><span>Описание</span><textarea rows={4} value={document.seo.description} onChange={(event) => onPatch({ seo: { ...document.seo, description: event.target.value } })} /></label><SelectField label="Индексация" value={document.seo.indexing} options={["NOINDEX", "INDEX"]} onChange={(value) => onPatch({ seo: { ...document.seo, indexing: value as "INDEX" | "NOINDEX" } })} /></section>{quarantinedCount ? <p className="composer-quarantine">В карантине: {quarantinedCount}. Эти специализированные блоки автоматически вернутся при совместимом типе страницы.</p> : null}</div>;
}

function CreatePageDialog({ mode, sourcePageId, onClose, onCreated }: { mode: "create" | "duplicate"; sourcePageId: string; onClose: () => void; onCreated: (payload: ApiPayload) => void }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(null); const form = new FormData(event.currentTarget); try { const response = await fetch("/api/admin/pages/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: mode, sourcePageId, title: form.get("title"), slug: form.get("slug"), pageType: form.get("pageType") }) }); const payload = await response.json() as ApiPayload; if (!response.ok || !payload.snapshot) throw payloadError(payload, "Страница не создана."); onCreated(payload); } catch (caught) { setError(caught instanceof Error ? caught.message : "Неизвестная ошибка."); setBusy(false); } }
  return <div className="composer-dialog-backdrop" role="presentation"><section className="composer-dialog" role="dialog" aria-modal="true" aria-labelledby="create-page-title"><header><h2 id="create-page-title">{mode === "create" ? "Новая пустая страница" : "Дублировать страницу"}</h2><button type="button" onClick={onClose}>Закрыть</button></header><form onSubmit={submit}><label><span>Название</span><input name="title" required maxLength={120} /></label><label><span>Адрес после ns-ars.ru</span><input name="slug" required placeholder="projects/new-story" pattern="[A-Za-z0-9 /-]+" /></label>{mode === "create" ? <label><span>Тип страницы</span><select name="pageType" defaultValue="PT_COMPOSITE">{CONTENT_TYPES.map((entry) => <option value={entry.id} key={entry.id}>{entry.name}</option>)}</select></label> : null}{error ? <p className="is-error">{error}</p> : null}<button className="admin-primary" type="submit" disabled={busy}>{busy ? "Создаю…" : mode === "create" ? "Создать пустую" : "Создать копию"}</button></form></section></div>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) { return <label className="composer-field"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>; }
function CheckField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) { return <label className="composer-check"><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span>{label}</span></label>; }
function handleDrop(event: DragEvent<HTMLDivElement>, index: number, blockId: string | null, move: (blockId: string, index: number) => void) { event.preventDefault(); if (blockId) move(blockId, index); }
function cloneBlockForEditor(block: ComposerBlock): ComposerBlock {
  const next = structuredClone(block);
  const token = crypto.randomUUID().replaceAll("-", "");
  next.blockId = `block_${token}`;
  if (Array.isArray(next.data.photoWindows)) {
    next.data.photoWindows = next.data.photoWindows.map((windowValue, index) =>
      isRecord(windowValue)
        ? { ...windowValue, windowId: `window_${token}_${index}` }
        : windowValue,
    );
  }
  if (next.type === "F20" && Array.isArray(next.data.slots)) {
    next.data.slots = next.data.slots.map((slotValue, slotIndex) => {
      if (!isRecord(slotValue)) return slotValue;
      const blocks = Array.isArray(slotValue.blocks)
        ? slotValue.blocks.filter(isComposerBlock).map(cloneBlockForEditor)
        : [];
      return {
        ...slotValue,
        slotId: `slot_${token}_${slotIndex}`,
        blocks: reindexComposerBlocks(blocks),
      };
    });
  }
  return next;
}
function toggleBlockHidden(block: ComposerBlock, commit: (updater: (current: ComposerPageDocument) => ComposerPageDocument) => void) { commit((current) => { current.blocks = current.blocks.map((item) => item.blockId === block.blockId ? { ...item, hidden: !item.hidden } : item); return current; }); }
function payloadError(payload: ApiPayload, fallback: string) { return new Error([payload.error, ...(payload.details ?? [])].filter(Boolean).join(" ") || fallback); }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function isComposerBlock(value: unknown): value is ComposerBlock { return isRecord(value) && typeof value.blockId === "string" && typeof value.type === "string" && isRecord(value.data) && isRecord(value.layout) && isRecord(value.responsive); }
