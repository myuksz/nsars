"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  cloneNavigationDocument,
  NAVIGATION_PLACEMENTS,
  reindexNavigationItems,
  type NavigationDocument,
  type NavigationPlacement,
} from "@/lib/navigation-contract";
import type {
  AdminPageOption,
  NavigationSnapshot,
} from "@/lib/site-store";
import { stableStringify } from "@/lib/page-contract";

type MenuPayload = {
  snapshot?: NavigationSnapshot;
  notice?: string;
  error?: string;
  details?: string[];
};

export function AdminMenuEditor({
  initialSnapshot,
  pageOptions,
  actorLabel,
}: {
  initialSnapshot: NavigationSnapshot;
  pageOptions: AdminPageOption[];
  actorLabel: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [document, setDocument] = useState(() =>
    cloneNavigationDocument(initialSnapshot.draft),
  );
  const [baseline, setBaseline] = useState(() =>
    stableStringify(initialSnapshot.draft),
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("Меню открыто как отдельный черновик.");
  const [error, setError] = useState<string | null>(null);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allowExit = useRef(false);
  const dirty = useMemo(
    () => stableStringify(document) !== baseline,
    [document, baseline],
  );

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty || allowExit.current) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function guardNavigation(
    event: React.MouseEvent<HTMLAnchorElement>,
    href: string,
  ) {
    if (!dirty) return;
    event.preventDefault();
    setPendingHref(href);
  }

  function updateItem(itemId: string, patch: Record<string, unknown>) {
    setDocument((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.itemId === itemId ? { ...item, ...patch } : item,
      ),
    }));
  }

  function moveItem(itemId: string, direction: -1 | 1) {
    setDocument((current) => {
      const selected = current.items.find((item) => item.itemId === itemId);
      if (!selected) return current;
      const group = current.items
        .filter((item) => item.placement === selected.placement)
        .sort((a, b) => a.position - b.position);
      const from = group.findIndex((item) => item.itemId === itemId);
      const to = from + direction;
      if (to < 0 || to >= group.length) return current;
      [group[from], group[to]] = [group[to], group[from]];
      const outside = current.items.filter(
        (item) => item.placement !== selected.placement,
      );
      return { ...current, items: reindexNavigationItems([...outside, ...group]) };
    });
  }

  function addItem() {
    const target = pageOptions[0];
    if (!target) return;
    const itemId = `nav_custom_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
    setDocument((current) => ({
      ...current,
      items: reindexNavigationItems([
        ...current.items,
        {
          itemId,
          label: target.label,
          targetPageId: target.pageId,
          placement: "primary",
          enabled: false,
          position: current.items.filter((item) => item.placement === "primary").length,
        },
      ]),
    }));
  }

  async function run(
    endpoint: string,
    body: Record<string, unknown>,
    method = "POST",
  ) {
    setBusy(endpoint);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as MenuPayload;
      if (!response.ok || !payload.snapshot) {
        throw new Error(
          [payload.error, ...(payload.details ?? [])].filter(Boolean).join(" ") ||
            "Операция меню не выполнена.",
        );
      }
      setSnapshot(payload.snapshot);
      setDocument(cloneNavigationDocument(payload.snapshot.draft));
      setBaseline(stableStringify(payload.snapshot.draft));
      setNotice(payload.notice ?? "Операция завершена.");
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Неизвестная ошибка.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function saveAndGo() {
    if (!pendingHref) return;
    const saved = await run(
      "/api/admin/menu/",
      { document, expectedDraftVersion: snapshot.draftVersion },
      "PUT",
    );
    if (saved) {
      allowExit.current = true;
      window.location.assign(pendingHref);
    }
  }

  const isBusy = busy !== null;
  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <div>
          <p className="admin-kicker">NS—ARS / РЕДАКЦИЯ</p>
          <h1>Меню сайта</h1>
        </div>
        <div className="admin-top-actions">
          <span className="admin-actor">{actorLabel}</span>
          <Link href="/admin/pages/page_home/" onClick={(event) => guardNavigation(event, "/admin/pages/page_home/")}>Страницы</Link>
          <Link href="/admin/media/" onClick={(event) => guardNavigation(event, "/admin/media/")}>Медиатека</Link>
          <form className="admin-logout-form" action="/api/admin/auth/logout/" method="post">
            <button className="admin-logout-button" type="submit">Выйти</button>
          </form>
        </div>
      </header>
      <nav className="admin-global-tabs" aria-label="Разделы конструктора">
        <Link href="/admin/pages/page_home/" onClick={(event) => guardNavigation(event, "/admin/pages/page_home/")}>Страницы</Link>
        <Link className="is-current" href="/admin/menu/" aria-current="page">Меню сайта</Link>
        <Link href="/admin/media/" onClick={(event) => guardNavigation(event, "/admin/media/")}>Медиатека</Link>
      </nav>
      <main className="admin-standalone">
        <div className="admin-state-row" role="status" aria-live="polite">
          <span className={dirty ? "state-dot is-dirty" : "state-dot"} />
          <strong>{dirty ? "Есть несохранённые изменения" : "Черновик сохранён"}</strong>
          <span>Версия {snapshot.draftVersion}</span>
        </div>
        <section className="editor-section">
          <header><h2>Пункты меню</h2></header>
          <div className="editor-fields">
            <p className="field-help">
              Каждый пункт ссылается на конкретную страницу. Скрытая или неопубликованная страница автоматически не попадает в публичное меню.
            </p>
            {NAVIGATION_PLACEMENTS.map((placement) => (
              <MenuGroup
                key={placement}
                placement={placement}
                document={document}
                pageOptions={pageOptions}
                onUpdate={updateItem}
                onMove={moveItem}
                onRemove={(itemId) =>
                  setDocument((current) => ({
                    ...current,
                    items: reindexNavigationItems(
                      current.items.filter((item) => item.itemId !== itemId),
                    ),
                  }))
                }
              />
            ))}
            <button className="admin-secondary" type="button" onClick={addItem}>
              + Добавить выключенный пункт
            </button>
          </div>
        </section>
        <aside className="standalone-actions" aria-label="Сохранение меню">
          <button
            className="admin-primary"
            type="button"
            disabled={!dirty || isBusy}
            onClick={() =>
              run(
                "/api/admin/menu/",
                { document, expectedDraftVersion: snapshot.draftVersion },
                "PUT",
              )
            }
          >
            {busy === "/api/admin/menu/" ? "Сохраняю…" : "Сохранить меню"}
          </button>
          <button
            className="admin-secondary"
            type="button"
            disabled={dirty || isBusy}
            onClick={() =>
              run("/api/admin/menu/publish/", {
                expectedDraftVersion: snapshot.draftVersion,
              })
            }
          >
            {busy === "/api/admin/menu/publish/" ? "Публикую…" : "Опубликовать меню"}
          </button>
          <div className="admin-message" aria-live="polite">
            {error ? <p className="is-error">{error}</p> : <p>{notice}</p>}
          </div>
          <ol className="compact-revisions">
            {snapshot.revisions.map((revision) => (
              <li key={revision.id}>
                <span>R{revision.revisionNo}</span>
                {revision.active ? (
                  <strong>АКТИВНА</strong>
                ) : (
                  <button
                    type="button"
                    disabled={dirty || isBusy}
                    onClick={() =>
                      run("/api/admin/menu/rollback/", {
                        targetRevisionId: revision.id,
                      })
                    }
                  >
                    Вернуть
                  </button>
                )}
              </li>
            ))}
          </ol>
        </aside>
      </main>
      {pendingHref ? (
        <div className="admin-dialog-backdrop" role="presentation">
          <div className="admin-dialog" role="dialog" aria-modal="true" aria-labelledby="menu-unsaved-title">
            <h2 id="menu-unsaved-title">Сохранить меню?</h2>
            <p>В черновике меню есть несохранённые изменения.</p>
            <div>
              <button className="admin-primary" type="button" disabled={isBusy} onClick={saveAndGo}>Сохранить и перейти</button>
              <button
                className="admin-secondary"
                type="button"
                disabled={isBusy}
                onClick={() => {
                  allowExit.current = true;
                  window.location.assign(pendingHref);
                }}
              >
                Перейти без сохранения
              </button>
              <button type="button" disabled={isBusy} onClick={() => setPendingHref(null)}>Остаться</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MenuGroup({
  placement,
  document,
  pageOptions,
  onUpdate,
  onMove,
  onRemove,
}: {
  placement: NavigationPlacement;
  document: NavigationDocument;
  pageOptions: AdminPageOption[];
  onUpdate: (itemId: string, patch: Record<string, unknown>) => void;
  onMove: (itemId: string, direction: -1 | 1) => void;
  onRemove: (itemId: string) => void;
}) {
  const items = document.items
    .filter((item) => item.placement === placement)
    .sort((a, b) => a.position - b.position);
  const titles: Record<NavigationPlacement, string> = {
    primary: "Основное меню",
    age: "Возрастные направления",
    footer: "Подвал",
  };
  return (
    <fieldset className="menu-group">
      <legend>{titles[placement]}</legend>
      {items.length === 0 ? <p className="field-help">Пунктов нет.</p> : null}
      {items.map((item, index) => (
        <div className="menu-item-row" key={item.itemId}>
          <label>
            <span>Подпись</span>
            <input
              value={item.label}
              maxLength={80}
              onChange={(event) => onUpdate(item.itemId, { label: event.target.value })}
            />
          </label>
          <label>
            <span>Страница</span>
            <select
              value={item.targetPageId}
              onChange={(event) =>
                onUpdate(item.itemId, { targetPageId: event.target.value })
              }
            >
              {pageOptions.map((page) => (
                <option value={page.pageId} key={page.pageId}>
                  {page.label}{page.publicVisible ? "" : " — скрыта"}
                </option>
              ))}
            </select>
          </label>
          <label className="menu-enabled">
            <input
              type="checkbox"
              checked={item.enabled}
              onChange={(event) => onUpdate(item.itemId, { enabled: event.target.checked })}
            />
            Включён
          </label>
          <div className="menu-row-actions">
            <button type="button" disabled={index === 0} onClick={() => onMove(item.itemId, -1)}>↑</button>
            <button type="button" disabled={index === items.length - 1} onClick={() => onMove(item.itemId, 1)}>↓</button>
            <button className="danger-link" type="button" onClick={() => onRemove(item.itemId)}>Удалить</button>
          </div>
        </div>
      ))}
    </fieldset>
  );
}
