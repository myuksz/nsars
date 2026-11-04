export const NAVIGATION_PLACEMENTS = ["primary", "age", "footer"] as const;

export type NavigationPlacement = (typeof NAVIGATION_PLACEMENTS)[number];

export type NavigationItem = {
  itemId: string;
  label: string;
  targetPageId: string;
  placement: NavigationPlacement;
  enabled: boolean;
  position: number;
};

export type NavigationDocument = {
  menuId: "menu_main";
  items: NavigationItem[];
};

export type NavigationValidationResult =
  | { ok: true; value: NavigationDocument }
  | { ok: false; errors: string[] };

export type PublicNavigationItem = {
  itemId: string;
  label: string;
  targetPageId: string;
  href: string;
};

export type PublicNavigation = Record<
  NavigationPlacement,
  PublicNavigationItem[]
>;

export const DEFAULT_NAVIGATION: NavigationDocument = {
  menuId: "menu_main",
  items: [
    item("nav_primary_gallery", "Работы", "page_gallery", "primary", 0),
    item("nav_primary_prices", "Комплектации", "page_prices", "primary", 1),
    item("nav_primary_about", "О нас", "page_about", "primary", 2),
    item("nav_primary_contacts", "Контакты", "page_contacts", "primary", 3),
    item("nav_age_kindergarten", "Детский сад", "page_kindergarten", "age", 0),
    item("nav_age_grade4", "4 класс", "page_grade4", "age", 1),
    item("nav_age_highschool", "Старшая школа", "page_highschool", "age", 2),
    item("nav_footer_home", "Главная", "page_home", "footer", 0),
    item("nav_footer_gallery", "Работы", "page_gallery", "footer", 1),
    item("nav_footer_prices", "Комплектации", "page_prices", "footer", 2),
    item("nav_footer_about", "О нас", "page_about", "footer", 3),
    item("nav_footer_contacts", "Контакты", "page_contacts", "footer", 4),
    item("nav_footer_legal", "Правовая информация", "page_legal", "footer", 5),
  ],
};

function item(
  itemId: string,
  label: string,
  targetPageId: string,
  placement: NavigationPlacement,
  position: number,
): NavigationItem {
  return { itemId, label, targetPageId, placement, enabled: true, position };
}

export function cloneNavigationDocument(
  value: NavigationDocument,
): NavigationDocument {
  return JSON.parse(JSON.stringify(value)) as NavigationDocument;
}

export function validateNavigationDocument(
  input: unknown,
  knownPageIds?: ReadonlySet<string>,
): NavigationValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { ok: false, errors: ["Меню должно быть объектом."] };
  }
  exactKeys(input, ["menuId", "items"], "$", errors);
  if (input.menuId !== "menu_main") {
    errors.push("$.menuId: поддерживается только menu_main.");
  }
  if (!Array.isArray(input.items) || input.items.length > 80) {
    errors.push("$.items: ожидается массив до 80 пунктов.");
  } else {
    const ids = new Set<string>();
    const positions = new Set<string>();
    input.items.forEach((value, index) => {
      const path = `$.items[${index}]`;
      if (!isRecord(value)) {
        errors.push(`${path}: пункт должен быть объектом.`);
        return;
      }
      exactKeys(
        value,
        ["itemId", "label", "targetPageId", "placement", "enabled", "position"],
        path,
        errors,
      );
      if (typeof value.itemId !== "string" || !/^nav_[a-z0-9_]{4,80}$/.test(value.itemId)) {
        errors.push(`${path}.itemId: некорректный идентификатор.`);
      } else if (ids.has(value.itemId)) {
        errors.push(`${path}.itemId: идентификатор повторяется.`);
      } else {
        ids.add(value.itemId);
      }
      if (typeof value.label !== "string" || value.label.trim().length < 1 || value.label.length > 80) {
        errors.push(`${path}.label: требуется строка длиной 1–80.`);
      }
      if (typeof value.targetPageId !== "string" || !/^page_[a-z0-9_]{1,80}$/.test(value.targetPageId)) {
        errors.push(`${path}.targetPageId: некорректный ID страницы.`);
      } else if (knownPageIds && !knownPageIds.has(value.targetPageId)) {
        errors.push(`${path}.targetPageId: страница отсутствует.`);
      }
      if (!NAVIGATION_PLACEMENTS.includes(value.placement as NavigationPlacement)) {
        errors.push(`${path}.placement: неизвестная область меню.`);
      }
      if (typeof value.enabled !== "boolean") {
        errors.push(`${path}.enabled: ожидается логическое значение.`);
      }
      if (!Number.isInteger(value.position) || Number(value.position) < 0) {
        errors.push(`${path}.position: ожидается целое число от нуля.`);
      } else if (typeof value.placement === "string") {
        const positionKey = `${value.placement}:${value.position}`;
        if (positions.has(positionKey)) {
          errors.push(`${path}.position: позиция в этой области повторяется.`);
        }
        positions.add(positionKey);
      }
    });
  }
  return errors.length
    ? { ok: false, errors }
    : { ok: true, value: input as unknown as NavigationDocument };
}

export function reindexNavigationItems(
  items: NavigationItem[],
): NavigationItem[] {
  const next: NavigationItem[] = [];
  for (const placement of NAVIGATION_PLACEMENTS) {
    items
      .filter((itemValue) => itemValue.placement === placement)
      .forEach((itemValue, position) => next.push({ ...itemValue, position }));
  }
  return next;
}

function exactKeys(
  input: Record<string, unknown>,
  allowed: readonly string[],
  path: string,
  errors: string[],
) {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!allowedSet.has(key)) errors.push(`${path}.${key}: неизвестное поле.`);
  }
  for (const key of allowed) {
    if (!(key in input)) errors.push(`${path}.${key}: обязательное поле отсутствует.`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
