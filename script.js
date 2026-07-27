/* ================================================================
    PEBBLE
    Version 0.9.1
    (Displayed in-app as "Version 1.0" — see the Settings panel
    footer. The visible version is the public release number and
    is intentionally decoupled from this internal dev version.)

    Features
    ✔ Navigation
    ✔ Add Expense
    ✔ Dynamic Categories
    ✔ Expense Rendering
    ✔ UI Menus
    ✔ Dashboard Engine (totals, progress bar, category summary, chart)
    ✔ Budget (in-memory, temporary default)
    ✔ Edit Expense
    ✔ Delete Expense
    ✔ Local Persistence (LocalStorage)
    ✔ Time Filters (All, Today, This Week, This Month, This Year)
    ✔ Custom Date Range Filter
    ✔ Filter UX Polish (default-to-Today, contextual subtitles)
    ✔ Payment Method (Cash / Digital, remembered across sessions)

    Pending
    □ Additional filter ranges (Yesterday, Last 7 Days, Last 30
      Days, Last Month, Last Year, etc.) — architecture is ready,
      not implemented.

   Implements:
     PHASE 1 — Screen navigation
     PHASE 2 — Add Expense form logic (amount validation, save,
                reset)
     PHASE 3 — Dynamic category rendering, empty state, expense
                card rendering, three-dot menu (UI only)
     REFINEMENT — `expenses` array is now the single source of
                truth. The DOM is rebuilt from it on every change
                instead of being mutated directly.
     PHASE 4 — Dashboard Engine. A single calculateDashboardData()
                function derives every dashboard number from
                `expenses` + `budget`. Nothing is ever incremented
                or decremented by hand. Rendering is split into
                one function per UI piece, each consuming the same
                calculated object. Filter buttons are intentionally
                left inactive — once filtering exists, it will just
                produce a filtered array to hand to the same
                calculation/render functions, no new plumbing needed.
     PHASE 5 — Expense Management (Edit + Delete). Expenses are
                located exclusively by `expense.id` — never by
                index, amount, category, or note. Both features end
                the same way every other mutation does: change
                `expenses`, then call renderExpenses() and
                updateDashboard(). Nothing recalculates dashboard
                numbers by hand; the existing calculation layer from
                PHASE 4 is reused untouched.
     PHASE 6 — Local Persistence. LocalStorage is storage, not
                state — `expenses` and `budget` remain the only
                source of truth in memory. loadState() populates
                them once at startup; every mutation that already
                existed (add, edit, delete, budget change) now also
                calls saveState() before re-rendering. Nothing about
                calculateDashboardData(), renderExpenses(), or
                updateDashboard() changes.
     PHASE 7 — Expense Filtering. `expenses` is still the only
                source of truth and is NEVER filtered in place.
                applyCurrentFilter() is the single place that
                decides which expenses belong to the active time
                filter; it returns a new filtered array and touches
                nothing else. renderExpenses() and updateDashboard()
                now accept whichever expense list they're given —
                they have no idea whether it's filtered. refreshUI()
                computes the filtered list once per change and hands
                it to both, so filtering logic exists in exactly one
                place. The filter selection lives in memory only
                (`currentFilter`) and is intentionally NOT persisted.
     PHASE 7.5 — Custom Date Range. Adds one more filter id,
                'custom', on top of PHASE 7's architecture — no
                rewrite. `customDateRange` ({from, to}) is new,
                in-memory-only state, exactly like `currentFilter`.
                getFilterStartDate()/getFilterEndDate() gained one
                switch case each; applyCurrentFilter() now checks
                both a lower AND upper bound instead of only a lower
                one, but its signature, callers, and every other
                filter's behavior are unchanged. Selecting the
                Custom chip doesn't filter immediately — it opens a
                small bottom sheet (reusing the existing sheet
                component) that only commits to `currentFilter` on
                Apply, after validation. renderExpenses() and
                updateDashboard() remain completely unaware that
                Custom exists.
     PHASE 7.6 — Filter UX Polish. Three independent fixes, no
                architecture changes:
                (1) Fixed a CSS cascade bug where .empty-state's own
                    display:flex silently beat [hidden]'s
                    display:none — the empty state could stay
                    visible under a populated list. Same guard the
                    other hideable elements already had, now applied
                    here too.
                (2) `currentFilter` now initializes to 'today'
                    instead of 'all'. Still never persisted.
                (3) One new helper, generateFilterDescription(),
                    is the single place that turns
                    (currentFilter, customDateRange, filteredExpenses)
                    into the small subtitle under the filter chips.
                    refreshUI() remains the one place that calls it —
                    no rendering logic duplicated, no strings
                    scattered elsewhere.
     PHASE 8 — Data Integrity & Validation. A stability pass, not a
                feature: everything from LocalStorage is now treated
                as untrusted. isValidExpense() checks id/amount/
                category/createdAt/note against schema (reusing
                the category manager, not a separate list) and loadState()
                filters every loaded expense through it — a failing
                expense is skipped, never repaired. A malformed
                top-level shape, or a non-finite budget, is ignored
                in favor of existing in-memory defaults; the app
                always boots. roundToTwoDecimals() normalizes stored
                amounts on both the create and edit paths so
                floating-point drift never accumulates — dashboard
                math is untouched, since it just sums whatever is
                already in `expenses`. The amount and budget inputs
                now also block 'e'/'E'/'+'/'-' at keydown, layered
                in front of the existing negative-value guard and
                the submit-time checks — three independent layers,
                none of which replaces the others.
     PHASE 9 — Stability & UI Polish. Three targeted fixes, no
                feature or architecture change: (1) both amount
                inputs now sanitize pasted text (sanitizeNumericPaste
                + handleNumericPaste), stripping anything but digits
                and a single decimal point, so a paste can no longer
                slip 'e'/'E'/'+'/'-' past the existing keydown guard;
                (2) the Custom Range date pickers get their `max`
                set to today on every open, and the submit handler
                separately rejects any from/to date after today as a
                safety net, while isValidExpense() now also rejects a
                createdAt in the future, in case a stray future date
                ever reaches LocalStorage; (3) renderChart() no
                longer destroys and recreates the Chart.js instance
                on every dashboard refresh — it updates the existing
                instance's data in place, which was the actual root
                cause of the pie chart occasionally rendering as an
                ellipse (destroy+recreate could remeasure the canvas
                before the surrounding DOM finished settling).
     PHASE 10 — Settings Panel. A right-side slide-over (see section
                19), reached via a new Settings icon in the Home
                header. Contains two accordion sections — Export
                Data and About Pebble — built with a generic
                setupAccordion() helper (max-height transition,
                measured via scrollHeight, no hardcoded heights) and
                a footer showing the public-facing "Version 1.0".
                CSV export (section 20) builds a Blob client-side
                from the full `expenses` array — Date/Amount/
                Category/Note columns, category names resolved via
                the existing category manager — with no changes to
                expenses, budget, filters, storage, validation, or
                the chart. Panel open/close follows the same
                show/hide + delayed-hidden pattern already used for
                the bottom sheets, just animating a horizontal slide
                instead of a vertical one.
     PHASE 11 — Payment Method. Adds a required `paymentMethod`
                field ('cash' | 'digital') to every expense, chosen
                from a two-button selector in the Add Expense form,
                styled to match the existing category selector
                (same .category-btn shell, a neutral selected-state
                accent instead of a per-category color). The last
                selected payment method is remembered in a new
                in-memory `lastPaymentMethod` variable, persisted to
                LocalStorage alongside `expenses`/`budget`, and used
                to preselect the field the next time Add Expense is
                opened. Old expenses saved before this phase have no
                `paymentMethod` — isValidExpense() does not require
                it, so they keep loading normally; when one of them
                is opened for editing, the field falls back to
                `lastPaymentMethod` (or 'digital' if nothing has ever
                been remembered), never to a blank/invalid state. No
                other calculation, filter, or rendering logic changes.
     PHASE 14 — Analytics Architecture Cleanup. The former standalone
                analytics.js is merged into this file (see section 0,
                PAGE ROUTING), so analytics.html now loads script.js
                like every other page. Purely structural: no behavior
                changes on either page, and Analytics still has no
                charts, calculations, or data reads — those remain
                for later Analytics tasks to add here, reusing this
                file's existing utilities instead of duplicating them
                in a separate file.
     PHASE 15 — Analytics Task 2: Month Navigation. Adds the ◀ July
                2026 ▶ selector to the top of analytics.html. One new
                piece of state, `analyticsSelectedMonth`
                ({year, month}), is the single source of truth every
                later Analytics task (summary, trend, categories,
                payment split, statistics, insights) will read
                instead of computing its own month — none of those
                calculations are implemented yet. stepAnalyticsMonth()
                is the only place that mutates it, rolling the year
                over correctly in both directions (Dec -> Jan and
                Jan -> Dec). renderAnalyticsMonthLabel() is the only
                place that writes to the DOM. Nothing here touches
                `expenses` or `budget`, and the selected month is
                intentionally not persisted, matching `currentFilter`
                on the Home screen.
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ================================================================
     0. SHARED DATA LAYER (PHASE 16 — Analytics Task 3: Summary Cards)
     Relocated here — verbatim, nothing about their behavior changes
     — from their previous positions further down in this file
     (formerly sections "2. APPLICATION STATE", "3. CATEGORY DATA",
     "4. SHARED FORMATTERS", and part of "LOCAL PERSISTENCE"). Those
     sections used to live inside the index.html-only part of this
     file, below the PAGE ROUTING check's early `return` for
     analytics.html — so Analytics had no way to reach `expenses`,
     currencyFormatter, or loadState() at all. Task 3 needs real
     expense data, so the pieces both pages depend on now run first,
     before either page's own logic. `expenses` remains the single
     in-memory source of truth for the whole app; nothing here
     filters or mutates it except loadState() itself.
     ================================================================ */

  const expenses = [];

  // Temporary in-memory budget. No persistence yet — this is the
  // one value later phases (LocalStorage, backend) will replace.
  // Everything downstream already reads from this variable, so
  // swapping its source later requires no changes elsewhere.
  let budget = 10000;

  // The most recently selected payment method (PHASE 11), one of
  // 'cash' | 'digital'. Persisted (see saveState()/loadState()
  // below) — the whole point of "remember last selection" is that
  // it survives a reload. Defaults to 'digital' until the user picks
  // anything, or if a saved value turns out to be invalid/missing.
  let lastPaymentMethod = 'digital';

  /* ================================================================
     0.4 CATEGORY MANAGER (v1.5.0 — Category Architecture Foundation)
     The single source of truth for categories, full stop. Every
     screen, list, dropdown, chart, statistic, search match, and CSV
     column that needs a category's name/emoji/color now goes through
     the small API below (getCategories/getCategoryById/
     getCategoryName/getCategoryEmoji/getCategoryColor/categoryExists)
     instead of touching a category array or map directly anywhere
     else in this file.

     Each category is a plain data object: { id, name, emoji, color,
     isDefault }. `color` is still just the CSS custom-property
     reference (style.css remains the one source of truth for the
     actual palette) — it exists on the object now so a future
     Manage Categories UI can read/display it without another schema
     change. `isDefault` distinguishes Pebble's built-in categories
     from ones a later phase lets a user create; nothing reads it yet.

     Categories are persisted separately from expenses, under their
     own LocalStorage key. On a first launch (or an old Pebble
     install with no `pebble-categories` entry yet) the manager seeds
     itself with DEFAULT_CATEGORIES and saves them immediately, so
     every later launch — including this same session's — loads from
     LocalStorage rather than re-deriving defaults in memory. This is
     purely architectural: there is still no way to add, rename, or
     delete a category in the UI. That's Phase B.

     Expenses are untouched by any of this — `expense.category`
     remains just the category id string it always was, never the
     full object, so old saved expenses keep loading and validating
     exactly as before.
     ================================================================ */

  const CATEGORIES_STORAGE_KEY = 'pebble-categories';

  const DEFAULT_CATEGORIES = [
    { id: 'food',          name: 'Food',          emoji: '🍔', color: 'var(--category-food)',          isDefault: true },
    { id: 'transport',     name: 'Transport',     emoji: '🚕', color: 'var(--category-transport)',     isDefault: true },
    { id: 'shopping',      name: 'Shopping',      emoji: '🛍️', color: 'var(--category-shopping)',      isDefault: true },
    { id: 'health',        name: 'Health',        emoji: '💊', color: 'var(--category-health)',        isDefault: true },
    { id: 'college',       name: 'College',       emoji: '🎓', color: 'var(--category-college)',       isDefault: true },
    { id: 'hostel',        name: 'Hostel',        emoji: '🏠', color: 'var(--category-hostel)',        isDefault: true },
    { id: 'entertainment', name: 'Entertainment', emoji: '🎮', color: 'var(--category-entertainment)', isDefault: true },
    { id: 'others',        name: 'Others',        emoji: '📦', color: 'var(--category-others)',        isDefault: true }
  ];

  // In-memory category collection + its id -> category lookup. Both
  // are populated exclusively by loadCategories() below and never
  // mutated directly anywhere else in this file (there's nothing yet
  // that adds/edits/removes a category — that's Phase B).
  let categories = [];
  let categoryMap = new Map();

  /**
   * Schema check for a single category loaded from LocalStorage.
   * Mirrors isValidExpense()'s "reject, don't repair" philosophy —
   * everything from LocalStorage is untrusted.
   * @param {*} category
   * @returns {boolean}
   */
  function isValidCategory(category) {
    return Boolean(
      category &&
      typeof category === 'object' &&
      typeof category.id === 'string' && category.id.trim() !== '' &&
      typeof category.name === 'string' && category.name.trim() !== '' &&
      typeof category.emoji === 'string' && category.emoji.trim() !== '' &&
      typeof category.color === 'string' && category.color.trim() !== '' &&
      typeof category.isDefault === 'boolean'
    );
  }

  function rebuildCategoryMap() {
    categoryMap = new Map(categories.map((category) => [category.id, category]));
  }

  /**
   * Persists the current in-memory `categories` array. Called after
   * loadCategories() seeds/repairs it, so LocalStorage and memory
   * never disagree. (No other code path mutates `categories` yet.)
   */
  function saveCategories() {
    try {
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(categories));
    } catch (error) {
      console.error('Pebble: failed to save categories.', error);
    }
  }

  /**
   * Loads categories from LocalStorage into `categories`/`categoryMap`.
   * On first launch (nothing saved yet), or if what's saved is
   * missing/corrupted/invalid, falls back to DEFAULT_CATEGORIES and
   * writes them back out — so the app always has a usable category
   * collection and later launches read the same defaults from
   * storage instead of re-deriving them.
   */
  function loadCategories() {
    let raw;
    try {
      raw = localStorage.getItem(CATEGORIES_STORAGE_KEY);
    } catch (error) {
      console.error('Pebble: LocalStorage is unavailable for categories.', error);
      categories = DEFAULT_CATEGORIES;
      rebuildCategoryMap();
      return;
    }

    if (!raw) {
      // First launch of v1.5.0 (or a pre-v1.5.0 install migrating
      // for the first time) — seed with defaults and persist them.
      categories = DEFAULT_CATEGORIES;
      rebuildCategoryMap();
      saveCategories();
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error('Pebble: saved categories are corrupted, resetting to defaults.', error);
      categories = DEFAULT_CATEGORIES;
      rebuildCategoryMap();
      saveCategories();
      return;
    }

    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isValidCategory)) {
      categories = parsed;
    } else {
      console.error('Pebble: saved categories failed validation, resetting to defaults.');
      categories = DEFAULT_CATEGORIES;
    }
    rebuildCategoryMap();
    saveCategories();
  }

  loadCategories();

  /**
   * Returns the full category collection. Callers must treat this
   * as read-only — there is no mutation path yet (Phase B).
   * @returns {Array<{id:string,name:string,emoji:string,color:string,isDefault:boolean}>}
   */
  function getCategories() {
    return categories;
  }

  /**
   * @param {string} id
   * @returns {{id:string,name:string,emoji:string,color:string,isDefault:boolean}|undefined}
   */
  function getCategoryById(id) {
    return categoryMap.get(id);
  }

  /**
   * @param {string} id
   * @returns {boolean}
   */
  function categoryExists(id) {
    return categoryMap.has(id);
  }

  /**
   * @param {string} id
   * @returns {string} the category's name, or "Others" if unknown.
   */
  function getCategoryName(id) {
    const category = getCategoryById(id);
    return category ? category.name : 'Others';
  }

  /**
   * @param {string} id
   * @returns {string} the category's emoji, or a neutral fallback if unknown.
   */
  function getCategoryEmoji(id) {
    const category = getCategoryById(id);
    return category ? category.emoji : '📦';
  }

  /**
   * Fixed palette custom categories are assigned from, one at a
   * time, cycling by how many custom categories already exist —
   * distinct from the 8 default hues above so a custom category is
   * never visually confused with a default one. Stored as a literal
   * color directly on the category object (see addCategory() below)
   * rather than a CSS variable reference, since there is no
   * `--category-<id>` variable for an id that doesn't exist yet at
   * build time.
   */
  const CUSTOM_CATEGORY_COLOR_PALETTE = [
    '#F43F5E', '#8B5CF6', '#14B8A6', '#F59E0B',
    '#0EA5E9', '#84CC16', '#D946EF', '#EAB308'
  ];

  /**
   * The one category id nothing may ever delete. It's the mandatory
   * migration target every deleted category's expenses fall back to
   * (see deleteCategory() below) — if it could be removed, that
   * fallback would have nowhere to point.
   */
  const PROTECTED_CATEGORY_ID = 'others';

  /**
   * Turns a category name into a URL/id-safe slug: lowercase, non
   * alphanumeric runs collapsed to a single hyphen, leading/trailing
   * hyphens trimmed. Never returns an empty string — falls back to
   * "category" so a name made entirely of symbols/emoji still gets
   * a usable id.
   * @param {string} name
   * @returns {string}
   */
  function slugifyCategoryName(name) {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return slug || 'category';
  }

  /**
   * Generates a category id guaranteed not to collide with any
   * existing one — starts from the slugified name, then appends a
   * short random suffix (and keeps trying) if that's already taken.
   * @param {string} name
   * @returns {string}
   */
  function generateCategoryId(name) {
    const base = slugifyCategoryName(name);
    if (!categoryExists(base)) return base;

    let candidate = base;
    while (categoryExists(candidate)) {
      candidate = `${base}-${generateId().slice(0, 5)}`;
    }
    return candidate;
  }

  /**
   * Case/whitespace-insensitive duplicate check against every
   * existing category name — "Food", "food", and " FOOD " must all
   * count as the same name (per the Add Category validation spec).
   * @param {string} name
   * @returns {boolean}
   */
  function isDuplicateCategoryName(name) {
    const normalized = name.trim().toLowerCase();
    return getCategories().some((category) => category.name.trim().toLowerCase() === normalized);
  }

  /**
   * Creates a new custom category from validated Add Category form
   * input, persists it, and returns it. Callers (the Add Category
   * sheet's submit handler) are expected to have already validated
   * name/emoji are non-empty and the name isn't a duplicate — this
   * function trusts that and focuses purely on construction +
   * persistence, mirroring how addExpense-equivalent mutations
   * elsewhere in this file stay separate from their form's
   * validation layer.
   * @param {{name: string, emoji: string}} input
   * @returns {{id:string,name:string,emoji:string,color:string,isDefault:boolean}}
   */
  function addCategory({ name, emoji }) {
    const trimmedName = name.trim();
    const trimmedEmoji = emoji.trim();
    const customCategoryCount = categories.filter((category) => !category.isDefault).length;

    const category = {
      id: generateCategoryId(trimmedName),
      name: trimmedName,
      emoji: trimmedEmoji,
      color: CUSTOM_CATEGORY_COLOR_PALETTE[customCategoryCount % CUSTOM_CATEGORY_COLOR_PALETTE.length],
      isDefault: false
    };

    categories.push(category);
    rebuildCategoryMap();
    saveCategories();

    return category;
  }

  /**
   * Counts how many saved expenses currently reference a category —
   * used both to decide the wording of the delete-confirmation
   * sheet and to know how many expenses deleteCategory() is about
   * to migrate.
   * @param {string} categoryId
   * @returns {number}
   */
  function countExpensesUsingCategory(categoryId) {
    return expenses.filter((expense) => expense.category === categoryId).length;
  }

  /**
   * Deletes a category after the caller has already confirmed with
   * the user. Never deletes an expense: any expense still pointing
   * at the deleted category is first migrated to the protected
   * "Others" bucket, exactly like the design spec requires ("Deleting
   * a category must NEVER delete expenses"). The "Others" category
   * itself can never be deleted, since it's the one fixed migration
   * target every other deletion relies on.
   * @param {string} categoryId
   * @returns {{success: boolean, migratedCount: number, reason?: 'protected'|'not-found'}}
   */
  function deleteCategory(categoryId) {
    if (categoryId === PROTECTED_CATEGORY_ID) {
      return { success: false, migratedCount: 0, reason: 'protected' };
    }

    const index = categories.findIndex((category) => category.id === categoryId);
    if (index === -1) {
      return { success: false, migratedCount: 0, reason: 'not-found' };
    }

    let migratedCount = 0;
    expenses.forEach((expense) => {
      if (expense.category === categoryId) {
        expense.category = PROTECTED_CATEGORY_ID;
        migratedCount += 1;
      }
    });

    categories.splice(index, 1);
    rebuildCategoryMap();
    saveCategories();

    if (migratedCount > 0) {
      saveState();
    }

    return { success: true, migratedCount };
  }

  /**
   * Resolves a category's color to an actual CSS color value. For
   * Pebble's 8 defaults, `category.color` is still a CSS custom-
   * property reference (e.g. "var(--category-food)") — style.css
   * remains the one source of truth for that palette, and this
   * resolves it exactly as before. Custom categories created via
   * Manage Categories (v1.5 Phase B) have no matching CSS variable,
   * so their `category.color` is a literal color value instead
   * (assigned once at creation from CUSTOM_CATEGORY_COLOR_PALETTE)
   * and is returned as-is. Used by the dashboard's category summary/
   * chart and by Analytics' Category Breakdown bars.
   * @param {string} categoryId
   * @returns {string} a CSS color value, e.g. "#F97316"
   */
  function getCategoryColor(categoryId) {
    const category = getCategoryById(categoryId);
    const rawColor = category ? category.color : 'var(--category-others)';

    const varMatch = /^var\((--[\w-]+)\)$/.exec(rawColor);
    if (varMatch) {
      return getComputedStyle(document.documentElement)
        .getPropertyValue(varMatch[1])
        .trim();
    }

    return rawColor;
  }

  /**
   * Single source of truth for Payment Method UI (PHASE 11) and its
   * CSV export label — mirrors the category manager pattern above
   * rather than introducing a differently-shaped lookup.
   */
  const PAYMENT_METHODS = [
    { id: 'cash', name: 'Cash', icon: '💵' },
    { id: 'digital', name: 'Digital', icon: '💳' }
  ];

  const PAYMENT_METHOD_MAP = new Map(PAYMENT_METHODS.map((method) => [method.id, method]));

  // Currency formatter — created once and reused everywhere instead
  // of being instantiated on every render (dashboard, expense cards,
  // CSV export, and now the Analytics summary cards), so formatting
  // never drifts between screens.
  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

  const STORAGE_KEY = 'pebble-data';

  /**
   * Checks a single expense loaded from LocalStorage against
   * Pebble's schema. Everything from LocalStorage is untrusted, so
   * this is deliberately strict — an expense that fails any single
   * check is rejected outright rather than repaired, since silently
   * rewriting corrupted data (e.g. forcing an unknown category to
   * "Others") would hide the corruption instead of discarding it.
   *
   * PHASE 11: `paymentMethod` is intentionally NOT required here.
   * Expenses saved before this phase existed have no such field,
   * and they must keep loading normally — isValidExpense() only
   * checks that IF present, it's one of the known values; a missing
   * field is fine, an invalid one is rejected. This keeps old data
   * working exactly as the task requires.
   * @param {*} expense
   * @returns {boolean}
   */
  function isValidExpense(expense) {
    if (!expense || typeof expense !== 'object') return false;

    const hasValidId = typeof expense.id === 'string' && expense.id.trim() !== '';
    const hasValidAmount = Number.isFinite(expense.amount) && expense.amount > 0;
    const hasValidCategory = categoryExists(expense.category);
    const createdAtTime = new Date(expense.createdAt).getTime();
    const hasValidCreatedAt =
      expense.createdAt !== null &&
      !Number.isNaN(createdAtTime) &&
      createdAtTime <= Date.now();
    const hasValidNote = expense.note === undefined || typeof expense.note === 'string';
    const hasValidPaymentMethod =
      expense.paymentMethod === undefined || PAYMENT_METHOD_MAP.has(expense.paymentMethod);

    return hasValidId && hasValidAmount && hasValidCategory && hasValidCreatedAt &&
      hasValidNote && hasValidPaymentMethod;
  }

  /**
   * Loads persisted state from LocalStorage into the existing
   * `expenses` array and `budget`/`lastPaymentMethod` variables.
   * `expenses` is mutated in place (expenses.length reset + push)
   * rather than reassigned, since it's declared `const` and every
   * other part of the app already holds a reference to it.
   *
   * Never renders anything itself — callers are expected to render
   * afterward. If nothing is stored, or the stored data is
   * corrupted, the existing in-memory defaults are kept and the
   * app continues normally; it never crashes because of
   * LocalStorage.
   */
  function loadState() {
    let raw;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      // LocalStorage can be unavailable (e.g. private browsing in
      // some browsers) — fall back to defaults silently.
      console.error('Pebble: LocalStorage is unavailable.', error);
      return;
    }

    if (!raw) return; // Nothing saved yet — keep defaults.

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error('Pebble: saved data is corrupted, resetting.', error);
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (removeError) {
        console.error('Pebble: failed to clear saved data.', removeError);
      }
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      // Not the shape Pebble expects at all (e.g. a bare number or
      // string got stored somehow) — keep in-memory defaults.
      console.error('Pebble: saved data has an unexpected shape, keeping defaults.');
      return;
    }

    if (Number.isFinite(parsed.budget)) {
      budget = parsed.budget;
    }

    if (PAYMENT_METHOD_MAP.has(parsed.lastPaymentMethod)) {
      lastPaymentMethod = parsed.lastPaymentMethod;
    }

    if (Array.isArray(parsed.expenses)) {
      expenses.length = 0;
      parsed.expenses
        .filter(isValidExpense)
        .forEach((expense) => expenses.push(expense));
    }
  }

  // Populate `expenses`/`budget`/`lastPaymentMethod` from
  // LocalStorage immediately, before either page's own logic below
  // runs — index.html's own initialization (section 22) re-renders
  // from this same state, and analytics.html (section 1 below) reads
  // it directly for the summary cards.
  loadState();


  /* ================================================================
     1. PAGE ROUTING (PHASE 14 — Analytics Architecture Cleanup)
     script.js is now shared by index.html and analytics.html (this
     replaces the former standalone analytics.js). Both pages load
     this exact same file, but every section below this point
     assumes index.html's markup — home screen, Add Expense form,
     Settings panel, and so on. analytics.html has none of those
     elements, so running that code there would throw on the first
     null reference. Detecting the page via an element that only
     exists on one of the two, and returning early, keeps this file a
     single source of truth without needing to null-guard every
     reference throughout the rest of the file.
     On analytics.html, only the Back button needs wiring: "Back" is
     a real page navigation to index.html rather than an in-page
     screen swap, so a flag is stashed in sessionStorage first, which
     is what tells index.html to reopen the Settings panel
     automatically on arrival (see section 19.1 below, which is the
     other half of this same flow and runs on index.html).
     ================================================================ */

  const analyticsScreen = document.getElementById('analytics-screen');

  if (analyticsScreen) {
    const backToSettingsBtn = document.getElementById('back-to-settings-btn');

    if (backToSettingsBtn) {
      backToSettingsBtn.addEventListener('click', () => {
        sessionStorage.setItem('pebble-reopen-settings', '1');
        window.location.href = 'index.html';
      });
    }

    /* ==============================================================
       1.1 MONTH NAVIGATION (TASK 2 — Analytics: Month Navigation)
       Navigation only — no summary/trend/category/payment/statistics/
       insight calculations are added here or anywhere else in this
       task.

       STATE: `analyticsSelectedMonth` is the single source of truth
       for which month Analytics is looking at. It's a plain
       {year, month} pair (month is 0-indexed, matching Date's own
       convention, so it plugs straight into `new Date(year, month, 1)`
       with no translation layer). Every later Analytics task (summary
       cards, charts, category ranking, payment split, statistics,
       insights) reads this same object instead of computing its own
       "current month" — they just do `const selectedMonth =
       analyticsSelectedMonth;` and derive their date range from it.
       Nothing here writes to `expenses` or `budget`, and nothing here
       is persisted — like `currentFilter` on the Home screen, the
       selected analytics month is intentionally session-only.
       ============================================================== */

    const monthNavPrevBtn = document.getElementById('analytics-prev-month-btn');
    const monthNavNextBtn = document.getElementById('analytics-next-month-btn');
    const monthNavLabelEl = document.getElementById('analytics-month-label');

    // Defined once and reused, same pattern as dateFormatter /
    // filterDateLabelFormatter elsewhere in this file, rather than
    // constructing a new Intl.DateTimeFormat on every render.
    const analyticsMonthFormatter = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric'
    });

    const analyticsSelectedMonth = {
      year: new Date().getFullYear(),
      month: new Date().getMonth() // 0-indexed: 0 = January
    };

    // How long the label stays faded out before its text is swapped
    // in — half of --transition-fast (180ms), so the fade-out and
    // fade-in read as one smooth crossfade rather than a hard cut.
    const MONTH_LABEL_TRANSITION_MS = 90;

    /**
     * Renders `analyticsSelectedMonth` into the label. A brief
     * opacity transition (CSS-driven, see .analytics-month-nav-label
     * in style.css) is layered on top purely for polish — the state
     * change itself already happened by the time this runs.
     */
    function renderAnalyticsMonthLabel() {
      if (!monthNavLabelEl) return;

      const labelDate = new Date(
        analyticsSelectedMonth.year,
        analyticsSelectedMonth.month,
        1
      );

      monthNavLabelEl.classList.add('analytics-month-label-transitioning');
      window.setTimeout(() => {
        monthNavLabelEl.textContent = analyticsMonthFormatter.format(labelDate);
        monthNavLabelEl.classList.remove('analytics-month-label-transitioning');
      }, MONTH_LABEL_TRANSITION_MS);
    }

    /**
     * Whether `analyticsSelectedMonth` is the real calendar month
     * right now. Computed fresh from `new Date()` on every call
     * rather than cached — this is a derived check, not new state,
     * so it stays in sync automatically if the app is left open
     * across a month boundary.
     * @returns {boolean}
     */
    function isAnalyticsSelectedMonthCurrent() {
      const now = new Date();
      return (
        analyticsSelectedMonth.year === now.getFullYear() &&
        analyticsSelectedMonth.month === now.getMonth()
      );
    }

    /**
     * Keeps the right chevron's disabled state in sync with
     * `analyticsSelectedMonth`. Uses the native `disabled` attribute
     * (same as #export-csv-btn elsewhere in this file) so the
     * existing :disabled styling in style.css applies for free, and
     * so a disabled button simply stops receiving click events —
     * no separate "is this allowed" check needed at the call site.
     */
    function updateAnalyticsMonthNavButtons() {
      if (!monthNavNextBtn) return;
      monthNavNextBtn.disabled = isAnalyticsSelectedMonthCurrent();
    }

    /**
     * Steps `analyticsSelectedMonth` by +1/-1 months, rolling the
     * year over in either direction (December -> January bumps the
     * year forward, January -> December bumps it back). This is the
     * only place that mutates the state object.
     *
     * Forward navigation is clamped at the real current month — once
     * there, +1 is a no-op. The right chevron is disabled at that
     * point too (see updateAnalyticsMonthNavButtons), so this guard
     * is a defensive second layer, not the primary mechanism.
     * @param {1 | -1} direction
     */
    function stepAnalyticsMonth(direction) {
      if (direction > 0 && isAnalyticsSelectedMonthCurrent()) return;

      let { year, month } = analyticsSelectedMonth;
      month += direction;

      if (month > 11) {
        month = 0;
        year += 1;
      } else if (month < 0) {
        month = 11;
        year -= 1;
      }

      analyticsSelectedMonth.year = year;
      analyticsSelectedMonth.month = month;
      renderAnalyticsMonthLabel();
      updateAnalyticsMonthNavButtons();
      updateAnalyticsSummary();
      updateAnalyticsTrend();
      updateCategoryBreakdown();
      updatePaymentBreakdown();
      updateAnalyticsStatistics();
      updateSmartInsight();
    }

    if (monthNavPrevBtn) {
      monthNavPrevBtn.addEventListener('click', () => stepAnalyticsMonth(-1));
    }
    if (monthNavNextBtn) {
      monthNavNextBtn.addEventListener('click', () => stepAnalyticsMonth(1));
    }

    // Initial paint — no transition needed on first load, so the
    // label is set directly rather than going through the fade path.
    // The selected month always starts as the current month, so the
    // right chevron also starts disabled.
    if (monthNavLabelEl) {
      const initialDate = new Date(
        analyticsSelectedMonth.year,
        analyticsSelectedMonth.month,
        1
      );
      monthNavLabelEl.textContent = analyticsMonthFormatter.format(initialDate);
    }
    updateAnalyticsMonthNavButtons();

    /* ==============================================================
       1.2 SUMMARY CARDS (TASK 3 — Analytics: Summary Cards)
       Follows the same architecture as the Home dashboard's
       calculateDashboardData()/render*() split (see sections 12–13
       further down, in the index.html-only part of this file):
       Selected Month -> filter `expenses` -> ONE calculation
       function -> ONE rendering function. `expenses` (section 0,
       SHARED DATA LAYER) is read only, never mutated, and
       `analyticsSelectedMonth` (1.1 above) stays the single source
       of truth for which month is showing — no second month
       variable is introduced here.
       ============================================================== */

    const summaryTotalSpentEl = document.getElementById('analytics-summary-total');
    const summaryTransactionsEl = document.getElementById('analytics-summary-transactions');
    const summaryAverageEl = document.getElementById('analytics-summary-average');

    /**
     * Returns only the expenses that fall within `selectedMonth`
     * ({year, month}, month 0-indexed), using a half-open
     * [monthStart, nextMonthStart) range so it works for any month —
     * past, present, or (defensively) future — not just "since the
     * 1st of the current month" like the Home dashboard's own
     * getCurrentMonthExpenses() does. Does not touch `expenseList`.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {Array}
     */
    function getAnalyticsMonthExpenses(expenseList, selectedMonth) {
      const monthStart = new Date(selectedMonth.year, selectedMonth.month, 1);
      const nextMonthStart = new Date(selectedMonth.year, selectedMonth.month + 1, 1);

      return expenseList.filter((expense) => {
        const createdAt = new Date(expense.createdAt);
        return createdAt >= monthStart && createdAt < nextMonthStart;
      });
    }

    /**
     * The one calculation function for the Summary Cards. Reads
     * only `expenseList` + `selectedMonth`; never touches the DOM.
     * With zero expenses in the month, every field is naturally 0 —
     * no special-cased branch needed for the "empty month" case.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {{totalSpent: number, transactionCount: number, averageExpense: number}}
     */
    function calculateAnalyticsSummary(expenseList, selectedMonth) {
      const monthExpenses = getAnalyticsMonthExpenses(expenseList, selectedMonth);

      const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
      const transactionCount = monthExpenses.length;
      const averageExpense = transactionCount > 0 ? totalSpent / transactionCount : 0;

      return { totalSpent, transactionCount, averageExpense };
    }

    /**
     * The one rendering function for the Summary Cards. Reads only
     * the object calculateAnalyticsSummary() returns and reuses the
     * existing currencyFormatter (section 0) — the same formatter
     * the Home dashboard uses — so ₹ formatting never drifts between
     * screens or gets duplicated here.
     * @param {ReturnType<typeof calculateAnalyticsSummary>} summaryData
     */
    function renderAnalyticsSummary(summaryData) {
      if (summaryTotalSpentEl) {
        summaryTotalSpentEl.textContent = currencyFormatter.format(summaryData.totalSpent);
      }
      if (summaryTransactionsEl) {
        summaryTransactionsEl.textContent = String(summaryData.transactionCount);
      }
      if (summaryAverageEl) {
        summaryAverageEl.textContent = currencyFormatter.format(summaryData.averageExpense);
      }
    }

    /**
     * Recomputes and repaints the Summary Cards for whatever month
     * `analyticsSelectedMonth` currently points to. The single place
     * that chains calculation -> rendering; called once below for
     * the initial paint, and again from stepAnalyticsMonth() every
     * time the chevrons change the month.
     */
    function updateAnalyticsSummary() {
      const summaryData = calculateAnalyticsSummary(expenses, analyticsSelectedMonth);
      renderAnalyticsSummary(summaryData);
    }

    // Initial paint, same as the month label/buttons above.
    updateAnalyticsSummary();

    /* ==============================================================
       1.3 SPENDING TREND (TASK 4 — Analytics: Daily Spending Trend)
       Same architecture as Summary Cards (1.2 above):
       analyticsSelectedMonth -> getAnalyticsMonthExpenses() ->
       calculateAnalyticsTrend() -> renderAnalyticsTrend(). Reuses
       getAnalyticsMonthExpenses() as-is rather than re-filtering by
       month a second way, and reuses the exact same Chart.js
       library/instance-update pattern the dashboard's pie chart uses
       (see renderChart(), further down in the index.html-only part
       of this file) — update the existing instance in place, never
       destroy + recreate, which is what caused that chart's
       stretching bug in the first place.
       ============================================================== */

    const trendChartCanvas = document.getElementById('analytics-trend-chart');

    // Kept here (like `spendingChart` for the dashboard pie chart)
    // so later renders update the existing instance instead of
    // destroying and rebuilding a new Chart.js instance on every
    // month change.
    let analyticsTrendChart = null;

    /**
     * The one calculation function for the Spending Trend. Builds a
     * complete day-by-day dataset for `selectedMonth` — one entry
     * per calendar day, including days with zero spending, so the
     * line stays continuous across the whole month. Never touches
     * the DOM.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {{labels: string[], values: number[]}}
     */
    function calculateAnalyticsTrend(expenseList, selectedMonth) {
      const monthExpenses = getAnalyticsMonthExpenses(expenseList, selectedMonth);

      // Last day of `selectedMonth`, via day 0 of the *next* month —
      // correctly returns 28/29/30/31 with no hardcoded month
      // lengths and no manual leap-year check.
      const daysInMonth = new Date(selectedMonth.year, selectedMonth.month + 1, 0).getDate();

      // One slot per day, defaulted to ₹0, summed in a single pass
      // over the month's expenses — multiple expenses on the same
      // day land in the same slot.
      const dailyTotals = new Array(daysInMonth).fill(0);
      monthExpenses.forEach((expense) => {
        const dayOfMonth = new Date(expense.createdAt).getDate(); // 1-indexed
        dailyTotals[dayOfMonth - 1] += expense.amount;
      });

      const labels = dailyTotals.map((_, index) => String(index + 1));

      return { labels, values: dailyTotals };
    }

    /**
     * The one rendering function for the Spending Trend. Reads only
     * the object calculateAnalyticsTrend() returns. Resolves its
     * colors from the same CSS custom properties the rest of Pebble
     * uses (mirrors getCategoryColor() further down in this file)
     * rather than hardcoding hex values here.
     * @param {ReturnType<typeof calculateAnalyticsTrend>} trendData
     */
    function renderAnalyticsTrend(trendData) {
      if (typeof Chart === 'undefined' || !trendChartCanvas) return;

      if (analyticsTrendChart) {
        // Update in place — same reasoning as the dashboard pie
        // chart's renderChart(): destroy() + new Chart() forces a
        // fresh canvas measurement that can capture a transient
        // size while the surrounding card is still settling, which
        // is what stretches/distorts the chart. update() reuses the
        // instance and never re-measures.
        analyticsTrendChart.data.labels = trendData.labels;
        analyticsTrendChart.data.datasets[0].data = trendData.values;
        analyticsTrendChart.update();
        return;
      }

      const rootStyles = getComputedStyle(document.documentElement);
      const lineColor = rootStyles.getPropertyValue('--color-text-primary').trim();
      const gridColor = rootStyles.getPropertyValue('--color-border').trim();
      const tickColor = rootStyles.getPropertyValue('--color-text-secondary').trim();

      analyticsTrendChart = new Chart(trendChartCanvas, {
        type: 'line',
        data: {
          labels: trendData.labels,
          datasets: [{
            data: trendData.values,
            borderColor: lineColor,
            backgroundColor: lineColor + '1A', // ~10% fill under the line
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.3,
            fill: true
          }]
        },
        options: {
          responsive: true,
          // Read-only sizing note: the chart lives inside a
          // fixed-height wrapper (.analytics-chart-wrap in
          // style.css), so it's given maintainAspectRatio:false to
          // fill that fixed box rather than hold a 1:1 ratio the
          // way the dashboard's pie chart does — a day-by-day line
          // has no reason to be square, and this avoids the same
          // stretching risk a second way.
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: tickColor, maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }
            },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: { color: tickColor }
            }
          }
        }
      });
    }

    /**
     * Recomputes and repaints the Spending Trend chart for whatever
     * month `analyticsSelectedMonth` currently points to. Called
     * once below for the initial paint, and again from
     * stepAnalyticsMonth() every time the chevrons change the month
     * — same hook point as updateAnalyticsSummary().
     */
    function updateAnalyticsTrend() {
      const trendData = calculateAnalyticsTrend(expenses, analyticsSelectedMonth);
      renderAnalyticsTrend(trendData);
    }

    // Initial paint, same as the summary cards above.
    updateAnalyticsTrend();

    /* ==============================================================
       1.4 CATEGORY BREAKDOWN (TASK 5 — Analytics: Category Breakdown)
       Same architecture as Summary Cards and Spending Trend:
       analyticsSelectedMonth -> getAnalyticsMonthExpenses() ->
       calculateCategoryBreakdown() -> renderCategoryBreakdown().
       Reuses getAnalyticsMonthExpenses() for the month filtering (no
       second way of narrowing to a month), the category manager for
       icon/name, currencyFormatter for amounts, and getCategoryColor()
       for each bar's color — all from section 0, SHARED DATA LAYER.
       Percentages here are intentionally NOT the dashboard's
       percentOfBudget/percentOfSpent (calculateDashboardData(),
       further down): this list has no concept of a monthly budget
       for an arbitrary past month, so "percentage" means percentage
       of that month's total spending, and each bar's width is
       relative to the highest-spending category, not to the budget.
       ============================================================== */

    const categoriesListEl = document.getElementById('analytics-categories-list');
    const categoriesEmptyEl = document.getElementById('analytics-categories-empty');

    /**
     * The one calculation function for the Category Breakdown. Reads
     * only from getAnalyticsMonthExpenses() — never touches
     * `expenses` directly — and returns categories sorted highest
     * spend first, each with its share of the month's total and its
     * bar width relative to the top category. Categories with no
     * spending that month are left out entirely, same as the
     * dashboard's own categoryBreakdown. Never touches the DOM.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {Array<{id:string, name:string, icon:string, amount:number, percentOfTotal:number, barWidthPercent:number}>}
     */
    function calculateCategoryBreakdown(expenseList, selectedMonth) {
      const monthExpenses = getAnalyticsMonthExpenses(expenseList, selectedMonth);
      const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      const categoryTotals = new Map();
      monthExpenses.forEach((expense) => {
        const current = categoryTotals.get(expense.category) || 0;
        categoryTotals.set(expense.category, current + expense.amount);
      });

      const breakdown = getCategories()
        .map((category) => ({
          id: category.id,
          name: category.name,
          icon: category.emoji,
          amount: categoryTotals.get(category.id) || 0
        }))
        .filter((category) => category.amount > 0)
        .sort((a, b) => b.amount - a.amount);

      // Sorted descending above, so the first entry (if any) is
      // always the highest-spending category — every bar's width is
      // computed relative to that one amount, so the top category's
      // bar is always the longest, at exactly 100%.
      const maxAmount = breakdown.length > 0 ? breakdown[0].amount : 0;

      return breakdown.map((category) => ({
        ...category,
        percentOfTotal: totalSpent > 0 ? (category.amount / totalSpent) * 100 : 0,
        barWidthPercent: maxAmount > 0 ? (category.amount / maxAmount) * 100 : 0
      }));
    }

    /**
     * The one rendering function for the Category Breakdown. Reads
     * only the array calculateCategoryBreakdown() returns. Shows
     * Pebble's existing empty-state markup/pattern (same hidden-
     * attribute toggle as #expense-history-empty) when the month has
     * no spending at all, rather than leaving the card blank.
     * @param {ReturnType<typeof calculateCategoryBreakdown>} categoryBreakdown
     */
    function renderCategoryBreakdown(categoryBreakdown) {
      if (!categoriesListEl) return;

      const isEmpty = categoryBreakdown.length === 0;
      categoriesListEl.hidden = isEmpty;
      if (categoriesEmptyEl) categoriesEmptyEl.hidden = !isEmpty;

      categoriesListEl.innerHTML = '';
      if (isEmpty) return;

      categoryBreakdown.forEach((category) => {
        const row = document.createElement('li');
        row.className = 'analytics-category-row';
        row.dataset.category = category.id;

        const top = document.createElement('div');
        top.className = 'analytics-category-top';

        const nameWrap = document.createElement('span');
        nameWrap.className = 'analytics-category-name';

        const icon = document.createElement('span');
        icon.className = 'analytics-category-icon';
        icon.textContent = category.icon;

        const name = document.createElement('span');
        name.textContent = category.name;

        nameWrap.append(icon, name);

        const figures = document.createElement('span');
        figures.className = 'analytics-category-figures';

        const amount = document.createElement('span');
        amount.className = 'analytics-category-amount';
        amount.textContent = currencyFormatter.format(category.amount);

        const percent = document.createElement('span');
        percent.className = 'analytics-category-percent';
        percent.textContent = `${Math.round(category.percentOfTotal)}%`;

        figures.append(amount, percent);
        top.append(nameWrap, figures);

        const bar = document.createElement('div');
        bar.className = 'analytics-category-bar';

        const barFill = document.createElement('div');
        barFill.className = 'analytics-category-bar-fill';
        barFill.style.width = `${category.barWidthPercent}%`;
        barFill.style.backgroundColor = getCategoryColor(category.id);

        bar.appendChild(barFill);
        row.append(top, bar);
        categoriesListEl.appendChild(row);
      });
    }

    /**
     * Recomputes and repaints the Category Breakdown for whatever
     * month `analyticsSelectedMonth` currently points to. Called
     * once below for the initial paint, and again from
     * stepAnalyticsMonth() every time the chevrons change the month
     * — same hook point as updateAnalyticsSummary()/updateAnalyticsTrend().
     */
    function updateCategoryBreakdown() {
      const categoryBreakdown = calculateCategoryBreakdown(expenses, analyticsSelectedMonth);
      renderCategoryBreakdown(categoryBreakdown);
    }

    // Initial paint, same as the summary cards and trend chart above.
    updateCategoryBreakdown();

    /* ==============================================================
       1.5 PAYMENT METHOD BREAKDOWN (TASK 6 — Analytics: Payment
       Methods)
       Same architecture as every other analytics section:
       analyticsSelectedMonth -> getAnalyticsMonthExpenses() ->
       calculatePaymentBreakdown() -> renderPaymentBreakdown().
       Reuses getAnalyticsMonthExpenses() for the month filtering (no
       second way of narrowing to a month), PAYMENT_METHOD_MAP as the
       set of valid ids, and currencyFormatter for amounts — all from
       section 0, SHARED DATA LAYER. Percentages are of that month's
       total spending (calculateAnalyticsSummary's totalSpent, computed
       fresh here from the same monthExpenses rather than imported, so
       this stays a pure function of its own inputs), same convention
       as Category Breakdown's percentOfTotal.
       ============================================================== */

    const paymentBarEl = document.getElementById('analytics-payment-bar');
    const paymentBarDigitalEl = document.getElementById('analytics-payment-bar-digital');
    const paymentBarCashEl = document.getElementById('analytics-payment-bar-cash');
    const paymentFiguresEl = document.getElementById('analytics-payment-figures');
    const paymentDigitalAmountEl = document.getElementById('analytics-payment-digital-amount');
    const paymentDigitalPercentEl = document.getElementById('analytics-payment-digital-percent');
    const paymentCashAmountEl = document.getElementById('analytics-payment-cash-amount');
    const paymentCashPercentEl = document.getElementById('analytics-payment-cash-percent');
    const paymentEmptyEl = document.getElementById('analytics-payment-empty');

    /**
     * The one calculation function for the Payment Method Breakdown.
     * Reads only from getAnalyticsMonthExpenses() — never touches
     * `expenses` directly. Expenses saved before payment method
     * tracking existed have no `paymentMethod` at all; same as
     * buildExpensesCsv() elsewhere in this file, those are left out
     * of the digital/cash split rather than guessed into either side.
     * If the month has no spending, every value safely falls back to
     * 0 via the totalSpent > 0 guards below — no special-cased branch
     * needed.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {{hasExpenses:boolean, digitalTotal:number, cashTotal:number, digitalPercent:number, cashPercent:number}}
     */
    function calculatePaymentBreakdown(expenseList, selectedMonth) {
      const monthExpenses = getAnalyticsMonthExpenses(expenseList, selectedMonth);
      const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

      let digitalTotal = 0;
      let cashTotal = 0;
      monthExpenses.forEach((expense) => {
        if (expense.paymentMethod === 'digital') {
          digitalTotal += expense.amount;
        } else if (expense.paymentMethod === 'cash') {
          cashTotal += expense.amount;
        }
      });

      return {
        hasExpenses: monthExpenses.length > 0,
        digitalTotal,
        cashTotal,
        digitalPercent: totalSpent > 0 ? (digitalTotal / totalSpent) * 100 : 0,
        cashPercent: totalSpent > 0 ? (cashTotal / totalSpent) * 100 : 0
      };
    }

    /**
     * The one rendering function for the Payment Method Breakdown.
     * Reads only the object calculatePaymentBreakdown() returns.
     * Shows the same hidden-attribute empty-state pattern as Category
     * Breakdown when the month has no expenses at all, rather than
     * leaving the card blank. The bar's two children are widthed
     * directly from digitalPercent/cashPercent, which always sum to
     * at most 100% of the same total, so they always meet cleanly
     * with no gap and no overlap.
     * @param {ReturnType<typeof calculatePaymentBreakdown>} paymentData
     */
    function renderPaymentBreakdown(paymentData) {
      if (!paymentBarDigitalEl || !paymentBarCashEl) return;

      const isEmpty = !paymentData.hasExpenses;
      if (paymentBarEl) paymentBarEl.hidden = isEmpty;
      if (paymentFiguresEl) paymentFiguresEl.hidden = isEmpty;
      if (paymentEmptyEl) paymentEmptyEl.hidden = !isEmpty;
      if (isEmpty) return;

      paymentBarDigitalEl.style.width = `${paymentData.digitalPercent}%`;
      paymentBarCashEl.style.width = `${paymentData.cashPercent}%`;

      if (paymentDigitalAmountEl) {
        paymentDigitalAmountEl.textContent = currencyFormatter.format(paymentData.digitalTotal);
      }
      if (paymentDigitalPercentEl) {
        paymentDigitalPercentEl.textContent = `${Math.round(paymentData.digitalPercent)}%`;
      }
      if (paymentCashAmountEl) {
        paymentCashAmountEl.textContent = currencyFormatter.format(paymentData.cashTotal);
      }
      if (paymentCashPercentEl) {
        paymentCashPercentEl.textContent = `${Math.round(paymentData.cashPercent)}%`;
      }
    }

    /**
     * Recomputes and repaints the Payment Method Breakdown for
     * whatever month `analyticsSelectedMonth` currently points to.
     * Called once below for the initial paint, and again from
     * stepAnalyticsMonth() every time the chevrons change the month —
     * same hook point as updateCategoryBreakdown().
     */
    function updatePaymentBreakdown() {
      const paymentData = calculatePaymentBreakdown(expenses, analyticsSelectedMonth);
      renderPaymentBreakdown(paymentData);
    }

    // Initial paint, same as every other analytics section above.
    updatePaymentBreakdown();

    /* ==============================================================
       1.6 MONTHLY STATISTICS (TASK 7 — Analytics: Monthly Statistics)
       Same architecture as every other analytics section:
       analyticsSelectedMonth -> getAnalyticsMonthExpenses() ->
       calculateAnalyticsStatistics() -> renderAnalyticsStatistics().
       Reuses getAnalyticsMonthExpenses() for the month filtering (no
       second way of narrowing to a month), the category manager for
       the Highest Expense icon/name, and currencyFormatter for amounts —
       all from section 0, SHARED DATA LAYER. Per-day totals and
       per-day counts are both derived from a single pass over
       monthExpenses (one Map keyed by day-of-month), so Highest
       Spending Day and Most Active Day never traverse the month's
       expenses separately.
       ============================================================== */

    const statisticsGridEl = document.getElementById('analytics-statistics-grid');
    const statisticsEmptyEl = document.getElementById('analytics-statistics-empty');
    const statHighestExpenseEl = document.getElementById('analytics-stat-highest-expense');
    const statHighestDayEl = document.getElementById('analytics-stat-highest-day');
    const statActiveDayEl = document.getElementById('analytics-stat-active-day');
    const statCategoriesUsedEl = document.getElementById('analytics-stat-categories-used');

    // Day-level label for the two "day" stats, e.g. "14 Jul" — no
    // year, since analyticsSelectedMonth's year is already shown in
    // the month nav label (1.1) above these stats; every day here is
    // already known to fall in that same month/year.
    const analyticsStatDateFormatter = new Intl.DateTimeFormat('en-GB', {
      day: 'numeric',
      month: 'short'
    });

    /**
     * The one calculation function for Monthly Statistics. Reads
     * only from getAnalyticsMonthExpenses() — never touches
     * `expenses` directly. Returns hasExpenses: false (and no
     * computed values) for an empty month rather than forcing zeroed
     * placeholders through the "highest"/"most active" logic, since
     * there's no meaningful "highest" of an empty set. Ties are
     * broken by earliest date/createdAt throughout, per spec.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @returns {{hasExpenses:boolean, highestExpense:Object|null, highestSpendingDay:{date:Date,total:number}|null, mostActiveDay:{date:Date,count:number}|null, categoriesUsedCount:number}}
     */
    function calculateAnalyticsStatistics(expenseList, selectedMonth) {
      const monthExpenses = getAnalyticsMonthExpenses(expenseList, selectedMonth);

      if (monthExpenses.length === 0) {
        return {
          hasExpenses: false,
          highestExpense: null,
          highestSpendingDay: null,
          mostActiveDay: null,
          categoriesUsedCount: 0
        };
      }

      // Highest Expense: largest amount; a tie is broken by whichever
      // expense was created earliest.
      let highestExpense = monthExpenses[0];
      monthExpenses.forEach((expense) => {
        const isHigherAmount = expense.amount > highestExpense.amount;
        const isTiedButEarlier =
          expense.amount === highestExpense.amount &&
          new Date(expense.createdAt) < new Date(highestExpense.createdAt);
        if (isHigherAmount || isTiedButEarlier) {
          highestExpense = expense;
        }
      });

      // One pass over monthExpenses builds per-day totals and counts
      // together, keyed by day-of-month — safe because
      // getAnalyticsMonthExpenses() has already narrowed everything
      // to a single calendar month, so a day number alone is a
      // unique key here.
      const dailyTotals = new Map();
      monthExpenses.forEach((expense) => {
        const createdAt = new Date(expense.createdAt);
        const dayKey = createdAt.getDate();
        const existing = dailyTotals.get(dayKey);
        if (existing) {
          existing.total += expense.amount;
          existing.count += 1;
        } else {
          dailyTotals.set(dayKey, { total: expense.amount, count: 1, date: createdAt });
        }
      });

      // Highest Spending Day and Most Active Day: both scan the same
      // per-day map once, each with its own "tie -> earliest date"
      // rule, per spec.
      let highestSpendingDay = null;
      let mostActiveDay = null;
      dailyTotals.forEach((dayData) => {
        const isHigherTotal = !highestSpendingDay || dayData.total > highestSpendingDay.total;
        const isTiedTotalButEarlier =
          highestSpendingDay &&
          dayData.total === highestSpendingDay.total &&
          dayData.date < highestSpendingDay.date;
        if (isHigherTotal || isTiedTotalButEarlier) {
          highestSpendingDay = dayData;
        }

        const isHigherCount = !mostActiveDay || dayData.count > mostActiveDay.count;
        const isTiedCountButEarlier =
          mostActiveDay && dayData.count === mostActiveDay.count && dayData.date < mostActiveDay.date;
        if (isHigherCount || isTiedCountButEarlier) {
          mostActiveDay = dayData;
        }
      });

      // Categories Used: unique category ids touched this month.
      const categoriesUsedCount = new Set(monthExpenses.map((expense) => expense.category)).size;

      return { hasExpenses: true, highestExpense, highestSpendingDay, mostActiveDay, categoriesUsedCount };
    }

    /**
     * The one rendering function for Monthly Statistics. Reads only
     * the object calculateAnalyticsStatistics() returns. Shows the
     * same hidden-attribute empty-state pattern as every other
     * analytics section when the month has no expenses at all,
     * rather than rendering zeroed/placeholder stat values.
     * @param {ReturnType<typeof calculateAnalyticsStatistics>} statsData
     */
    
    function renderAnalyticsStatistics(statsData) {
      if (!statisticsGridEl) return;

      const isEmpty = !statsData.hasExpenses;
      statisticsGridEl.hidden = isEmpty;
      if (statisticsEmptyEl) statisticsEmptyEl.hidden = !isEmpty;
      if (isEmpty) return;

      if (statHighestExpenseEl) {
        const category = getCategoryById(statsData.highestExpense.category);
        const icon = category ? category.emoji : '📦';
        const name = category ? category.name : statsData.highestExpense.category;

        statHighestExpenseEl.innerHTML = `
          <div>${icon} ${name}</div>
          <div class="analytics-stat-secondary">
            ${currencyFormatter.format(statsData.highestExpense.amount)}
          </div>
        `;
      }

      if (statHighestDayEl) {
        statHighestDayEl.innerHTML = `
          <div>${analyticsStatDateFormatter.format(statsData.highestSpendingDay.date)}</div>
          <div class="analytics-stat-secondary">
            ${currencyFormatter.format(statsData.highestSpendingDay.total)}
          </div>
        `;
      }

      if (statActiveDayEl) {
        const count = statsData.mostActiveDay.count;

        statActiveDayEl.innerHTML = `
          <div>${analyticsStatDateFormatter.format(statsData.mostActiveDay.date)}</div>
          <div class="analytics-stat-secondary">
            ${count} expense${count === 1 ? '' : 's'}
          </div>
        `;
      }

      if (statCategoriesUsedEl) {
        const count = statsData.categoriesUsedCount;

        statCategoriesUsedEl.innerHTML = `
          <div>${count}</div>
          <div class="analytics-stat-secondary">
            categor${count === 1 ? 'y' : 'ies'}
          </div>
        `;
      }
    }

    /**
     * Recomputes and repaints Monthly Statistics for whatever month
     * `analyticsSelectedMonth` currently points to. Called once below
     * for the initial paint, and again from stepAnalyticsMonth()
     * every time the chevrons change the month — same hook point as
     * updatePaymentBreakdown().
     */
    function updateAnalyticsStatistics() {
      const statsData = calculateAnalyticsStatistics(expenses, analyticsSelectedMonth);
      renderAnalyticsStatistics(statsData);
    }

    // Initial paint, same as every other analytics section above.
    updateAnalyticsStatistics();

    /* ==============================================================
       1.7 SMART INSIGHT (TASK 8 — Analytics: Smart Insight)
       Same overall architecture as every other analytics section —
       analyticsSelectedMonth -> calculateSmartInsight() ->
       renderSmartInsight() — but calculateSmartInsight() is itself a
       small priority-ordered engine rather than one big calculation:
       each insight category (budget exceeded, budget saved, spending
       comparison, largest category, payment habit, spending
       activity) gets its own pure helper that returns either an
       {icon, message} object or null, never touching the DOM. The
       engine below evaluates them in priority order and the first
       non-null result wins — never more than one insight, never a
       forced weak one.

       No new filtering or traversal is introduced here: every helper
       is fed data from the exact same calculate*() functions the
       sections above already use (calculateAnalyticsSummary,
       calculateCategoryBreakdown, calculatePaymentBreakdown,
       calculateAnalyticsStatistics), so Smart Insight can never drift
       from what Summary/Categories/Payment/Statistics are already
       showing for this month.
       ============================================================== */

    const insightTextEl = document.getElementById('analytics-insight-text');
    const insightIconEl = document.getElementById('analytics-insight-icon');
    const insightMessageEl = document.getElementById('analytics-insight-message');

    /**
     * Pure helper: the month immediately before `selectedMonth`,
     * rolling the year back at January. Deliberately separate from
     * stepAnalyticsMonth() (1.1 above) — that function mutates
     * `analyticsSelectedMonth` in place and is clamped to "today" for
     * forward navigation, neither of which applies here; this is just
     * arithmetic on a {year, month} pair for the Spending Comparison
     * insight below.
     * @param {{year:number, month:number}} selectedMonth
     * @returns {{year:number, month:number}}
     */
    function getPreviousAnalyticsMonth(selectedMonth) {
      let { year, month } = selectedMonth;
      month -= 1;
      if (month < 0) {
        month = 11;
        year -= 1;
      }
      return { year, month };
    }

    /**
     * Insight 1 (highest priority): the month's spending has already
     * passed the budget. Shown regardless of whether the month is
     * still in progress or complete, per spec. The overspent amount
     * is always (totalSpent - budget), which is guaranteed positive
     * by the totalSpent > budgetAmount guard, so it never needs a
     * defensive Math.abs/clamp to avoid a negative-looking value.
     * @param {number} totalSpent
     * @param {number} budgetAmount
     * @returns {{icon:string, message:string}|null}
     */
    function calculateBudgetExceededInsight(totalSpent, budgetAmount) {
      if (budgetAmount <= 0 || totalSpent <= budgetAmount) return null;

      const overspent = totalSpent - budgetAmount;
      return { icon: '⚠️', message: `You exceeded your monthly budget by ${currencyFormatter.format(overspent)}.` };
    }

    /**
     * Insight 2: the month finished (or is far enough into finishing)
     * under budget. Restricted to a completed month or the current
     * month from the 25th onward, so this never claims "you saved"
     * with most of the month's spending still ahead of it.
     * @param {number} totalSpent
     * @param {number} budgetAmount
     * @param {boolean} isCurrentMonth
     * @param {number} todayDayOfMonth
     * @returns {{icon:string, message:string}|null}
     */
    function calculateBudgetSavedInsight(totalSpent, budgetAmount, isCurrentMonth, todayDayOfMonth) {
      if (budgetAmount <= 0 || totalSpent >= budgetAmount) return null;

      const LATE_MONTH_DAY = 25;
      const isCompletedMonth = !isCurrentMonth;
      const isLateInCurrentMonth = isCurrentMonth && todayDayOfMonth >= LATE_MONTH_DAY;
      if (!isCompletedMonth && !isLateInCurrentMonth) return null;

      const saved = budgetAmount - totalSpent;
      return { icon: '🎉', message: `You're ${currencyFormatter.format(saved)} under your monthly budget.` };
    }

    /**
     * Insight 3: how this month's total compares to the previous
     * month's. Skipped entirely with no previous-month spending to
     * compare against (an empty/zero previous month isn't a
     * meaningful baseline — spec explicitly rules out comparing
     * against zero). "Meaningful" requires BOTH a relative and an
     * absolute threshold, not percentage alone: a month that went
     * from ₹40 to ₹80 is a "100% increase" that's still trivial in
     * real money, and a month that went from ₹40,000 to ₹44,800 is
     * only a 12% move but a real ₹4,800 swing — either threshold
     * alone lets one of those slip through as noise or gets
     * suppressed as too small, so both must clear together.
     * @param {number} totalSpent
     * @param {number} previousTotalSpent
     * @returns {{icon:string, message:string}|null}
     */
    function calculateSpendingComparisonInsight(totalSpent, previousTotalSpent) {
      if (previousTotalSpent <= 0) return null;

      const percentChange = ((totalSpent - previousTotalSpent) / previousTotalSpent) * 100;
      const absoluteChange = Math.abs(totalSpent - previousTotalSpent);

      const MIN_PERCENT_CHANGE = 12; // ignore small relative swings
      const MIN_ABSOLUTE_CHANGE = 300; // ignore swings that are technically a big % but a trivial ₹ amount
      if (Math.abs(percentChange) < MIN_PERCENT_CHANGE || absoluteChange < MIN_ABSOLUTE_CHANGE) return null;

      const roundedPercent = Math.round(Math.abs(percentChange));
      return percentChange > 0
        ? { icon: '📈', message: `You spent ${roundedPercent}% more than last month.` }
        : { icon: '📉', message: `You spent ${roundedPercent}% less than last month.` };
    }

    /**
     * Insight 4: whether one category clearly dominates the month.
     * Reads only the array calculateCategoryBreakdown() already
     * returns (sorted highest first) — no separate category totals
     * computed here. "Clearly dominant" requires the top category to
     * both hold a real majority-ish share of total spending AND lead
     * the runner-up by a wide margin, so three categories sitting at
     * 34%/33%/33% (technically "highest") isn't reported as
     * dominance.
     * @param {ReturnType<typeof calculateCategoryBreakdown>} categoryBreakdown
     * @returns {{icon:string, message:string}|null}
     */
    function calculateLargestCategoryInsight(categoryBreakdown) {
      if (categoryBreakdown.length === 0) return null;

      const DOMINANCE_SHARE = 40; // top category must be ~2/5 of total spending
      const DOMINANCE_MARGIN = 15; // and lead the runner-up by 15+ percentage points
      const [top, second] = categoryBreakdown;
      if (top.percentOfTotal < DOMINANCE_SHARE) return null;
      if (second && top.percentOfTotal - second.percentOfTotal < DOMINANCE_MARGIN) return null;

      return { icon: top.icon, message: `${top.name} was your biggest spending category this month.` };
    }

    /**
     * Insight 5: whether one payment method clearly dominates the
     * month. Reads only the object calculatePaymentBreakdown()
     * already returns. "Clearly dominant" is set well above a bare
     * majority (70%) so a roughly 55/45 split — real, but not a
     * strong habit — stays quiet.
     * @param {ReturnType<typeof calculatePaymentBreakdown>} paymentData
     * @returns {{icon:string, message:string}|null}
     */
    function calculatePaymentHabitInsight(paymentData) {
      if (!paymentData.hasExpenses) return null;

      const DOMINANCE_SHARE = 70;
      if (paymentData.digitalPercent >= DOMINANCE_SHARE) {
        return { icon: '💳', message: 'Most of your spending was paid digitally.' };
      }
      if (paymentData.cashPercent >= DOMINANCE_SHARE) {
        return { icon: '💵', message: 'Most of your spending was paid in cash.' };
      }
      return null;
    }

    /**
     * Insight 6 (lowest priority, fallback before the default
     * message): calls out the busiest spending day if it actually
     * stands out, reusing calculateAnalyticsStatistics()'s
     * highestSpendingDay rather than re-deriving it. Only meaningful
     * once a single day accounts for a real chunk (1/4+) of the
     * whole month's spending — otherwise a fairly even month would
     * get an arbitrary-feeling callout for a day only marginally
     * ahead of the rest.
     * @param {ReturnType<typeof calculateAnalyticsStatistics>} statsData
     * @param {number} totalSpent
     * @returns {{icon:string, message:string}|null}
     */
    function calculateSpendingActivityInsight(statsData, totalSpent) {
      if (!statsData.hasExpenses || totalSpent <= 0) return null;

      const MIN_DAY_SHARE = 25; // the busiest single day must be 1/4+ of the month's total
      const dayShare = (statsData.highestSpendingDay.total / totalSpent) * 100;
      if (dayShare < MIN_DAY_SHARE) return null;

      const dayLabel = analyticsStatDateFormatter.format(statsData.highestSpendingDay.date);
      return { icon: '📅', message: `Your busiest spending day was ${dayLabel}.` };
    }

    /**
     * The insight engine. Gathers each candidate's inputs from the
     * existing calculate*() functions exactly once, then evaluates
     * the six helpers above in priority order (budget exceeded ->
     * budget saved -> spending comparison -> largest category ->
     * payment habit -> spending activity) and returns the first
     * non-null result. Returns null when nothing qualifies, which
     * renderSmartInsight() below turns into the neutral default
     * message rather than forcing a weak insight. Never touches the
     * DOM.
     * @param {Array} expenseList
     * @param {{year:number, month:number}} selectedMonth
     * @param {number} budgetAmount
     * @returns {{icon:string, message:string}|null}
     */
    function calculateSmartInsight(expenseList, selectedMonth, budgetAmount) {
      const totalSpent = calculateAnalyticsSummary(expenseList, selectedMonth).totalSpent;
      const previousTotalSpent = calculateAnalyticsSummary(
        expenseList,
        getPreviousAnalyticsMonth(selectedMonth)
      ).totalSpent;
      const categoryBreakdown = calculateCategoryBreakdown(expenseList, selectedMonth);
      const paymentData = calculatePaymentBreakdown(expenseList, selectedMonth);
      const statsData = calculateAnalyticsStatistics(expenseList, selectedMonth);
      const isCurrentMonth = isAnalyticsSelectedMonthCurrent();
      const todayDayOfMonth = new Date().getDate();

      const insightCandidates = [
        () => calculateBudgetExceededInsight(totalSpent, budgetAmount),
        () => calculateBudgetSavedInsight(totalSpent, budgetAmount, isCurrentMonth, todayDayOfMonth),
        () => calculateSpendingComparisonInsight(totalSpent, previousTotalSpent),
        () => calculateLargestCategoryInsight(categoryBreakdown),
        () => calculatePaymentHabitInsight(paymentData),
        () => calculateSpendingActivityInsight(statsData, totalSpent)
      ];

      for (const getInsight of insightCandidates) {
        const insight = getInsight();
        if (insight) return insight;
      }

      return null;
    }

    /**
     * The one rendering function for Smart Insight. Reads only the
     * object (or null) calculateSmartInsight() returns. With no
     * qualifying insight, shows a single neutral default line — in
     * the same element, muted via .analytics-insight-text-empty —
     * rather than toggling a separate empty-state block, since "no
     * insight yet" isn't the same thing as "no expenses this month"
     * (an active month with plenty of expenses can still have no
     * insight that clears every threshold above).
     * @param {{icon:string, message:string}|null} insight
     */
    function renderSmartInsight(insight) {
      if (!insightTextEl || !insightIconEl || !insightMessageEl) return;

      if (insight) {
        insightTextEl.classList.remove('analytics-insight-text-empty');
        insightIconEl.textContent = insight.icon;
        insightMessageEl.textContent = insight.message;
      } else {
        insightTextEl.classList.add('analytics-insight-text-empty');
        insightIconEl.textContent = '';
        insightMessageEl.textContent = 'Keep tracking your expenses to unlock monthly insights.';
      }
    }

    /**
     * Recomputes and repaints Smart Insight for whatever month
     * `analyticsSelectedMonth` currently points to. Called once below
     * for the initial paint, and again from stepAnalyticsMonth() every
     * time the chevrons change the month — same hook point as
     * updateAnalyticsStatistics().
     */
    function updateSmartInsight() {
      const insight = calculateSmartInsight(expenses, analyticsSelectedMonth, budget);
      renderSmartInsight(insight);
    }

    // Initial paint, same as every other analytics section above.
    updateSmartInsight();

    return;
  }

  /* ================================================================
     1. DOM REFERENCES
     ================================================================ */

  // Screens
  const homeScreen = document.getElementById('home-screen');
  const addExpenseScreen = document.getElementById('add-expense-screen');

  // Navigation controls
  const addExpenseFab = document.getElementById('add-expense-fab');
  const backToHomeBtn = document.getElementById('back-to-home-btn');

  // Form + fields
  const addExpenseForm = document.getElementById('add-expense-form');
  const addExpenseTitle = document.getElementById('add-expense-title');
  const saveExpenseBtn = document.getElementById('save-expense-btn');
  const amountInput = document.getElementById('expense-amount-input');
  const categorySelector = document.getElementById('category-selector');
  const categoryHiddenInput = document.getElementById('expense-category-input');
  const noteInput = document.getElementById('expense-note-input');

  // Payment Method selector (PHASE 11)
  const paymentMethodSelector = document.getElementById('payment-method-selector');
  const paymentMethodHiddenInput = document.getElementById('expense-payment-method-input');

  // Success toast (PHASE 12)
  const toastEl = document.getElementById('toast');
  const toastIconEl = document.getElementById('toast-icon');
  const toastMessageEl = document.getElementById('toast-message');

  // Expense history
  const expenseHistoryList = document.getElementById('expense-history-list');
  const expenseHistoryEmpty = document.getElementById('expense-history-empty');

  // Dashboard (PHASE 4)
  const monthlySpendingAmountEl = document.getElementById('monthly-spending-amount');
  const remainingBudgetCard = document.getElementById('remaining-budget-card');
  const remainingBudgetAmountEl = document.getElementById('remaining-budget-amount');
  const budgetProgressTrack = document.getElementById('budget-progress-track');
  const categorySummaryList = document.getElementById('category-summary-list');
  const spendingChartCanvas = document.getElementById('spending-chart');

  // Budget bottom sheet (PHASE 4 — integrating with existing markup)
  const budgetSheetOverlay = document.getElementById('budget-sheet-overlay');
  const budgetSheetForm = document.getElementById('budget-sheet-form');
  const budgetAmountInput = document.getElementById('budget-amount-input');
  const budgetCancelBtn = document.getElementById('budget-cancel-btn');

  // Expense Detail bottom sheet (v1.4.0 — TASK 10, integrating with
  // existing markup, same show/hide pattern as the budget sheet
  // above). Edit/Delete inside it call the existing
  // startEditExpense()/deleteExpense() functions — see section 15.5.
  const expenseDetailSheetOverlay = document.getElementById('expense-detail-sheet-overlay');
  const expenseDetailSheet = document.getElementById('expense-detail-sheet');
  const expenseDetailCloseBtn = document.getElementById('expense-detail-close-btn');
  const expenseDetailIconEl = document.getElementById('expense-detail-icon');
  const expenseDetailCategoryEl = document.getElementById('expense-detail-category');
  const expenseDetailAmountEl = document.getElementById('expense-detail-amount');
  const expenseDetailPaymentEl = document.getElementById('expense-detail-payment');
  const expenseDetailDateEl = document.getElementById('expense-detail-date');
  const expenseDetailTimeEl = document.getElementById('expense-detail-time');
  const expenseDetailNoteCard = document.getElementById('expense-detail-note-card');
  const expenseDetailNoteText = document.getElementById('expense-detail-note-text');
  const expenseDetailEditBtn = document.getElementById('expense-detail-edit-btn');
  const expenseDetailDeleteBtn = document.getElementById('expense-detail-delete-btn');

  // History filters (PHASE 7) — static buttons already in the
  // markup; captured once since the set never changes at runtime.
  const filterButtons = document.querySelectorAll('#history-filters .filter-btn');
  const filterDescriptionEl = document.getElementById('filter-description');
  const historyFiltersNav = document.getElementById('history-filters');
  const filtersScrollHint = document.getElementById('filters-scroll-hint');

  // Search bar (TASK 9) — sits below the filters, searches within
  // whatever currentFilter already narrowed `expenses` down to.
  const expenseSearchInput = document.getElementById('expense-search-input');
  const expenseSearchClearBtn = document.getElementById('expense-search-clear-btn');

  // Custom date range sheet (PHASE 7.5 — integrating with existing
  // bottom sheet markup, same pattern as the budget sheet above)
  const customRangeSheetOverlay = document.getElementById('custom-range-sheet-overlay');
  const customRangeForm = document.getElementById('custom-range-form');
  const customRangeFromInput = document.getElementById('custom-range-from');
  const customRangeToInput = document.getElementById('custom-range-to');
  const customRangeErrorEl = document.getElementById('custom-range-error');
  const customRangeCancelBtn = document.getElementById('custom-range-cancel-btn');

  // Settings panel (PHASE 10 — slide-over, separate from the
  // existing bottom-sheet pattern since it's a side panel, not a
  // sheet, but follows the same show/hide + delayed-hidden approach)
  const openSettingsBtn = document.getElementById('open-settings-btn');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const settingsOverlay = document.getElementById('settings-overlay');
  const settingsPanel = document.getElementById('settings-panel');
  const exportDataToggle = document.getElementById('export-data-toggle');
  const exportDataPanel = document.getElementById('export-data-panel');
  const exportCsvBtn = document.getElementById('export-csv-btn');
  const exportEmptyMessageEl = document.getElementById('export-empty-message');
  const aboutPebbleToggle = document.getElementById('about-pebble-toggle');
  const aboutPebblePanel = document.getElementById('about-pebble-panel');

  // Analytics entry point (PHASE 13 — v1.2 Analytics Foundation).
  // Analytics itself lives on its own page (analytics.html); this is
  // just the settings row that navigates there.
  const openAnalyticsBtn = document.getElementById('open-analytics-btn');

  // Manage Categories (v1.5 Phase B) — the Settings row, its bottom
  // sheet, the nested Add Category sheet, and the nested Delete
  // Category confirmation sheet. All three sheets follow the exact
  // same show/hide pattern as the Budget/Expense Detail sheets above.
  const openManageCategoriesBtn = document.getElementById('open-manage-categories-btn');
  const manageCategoriesSheetOverlay = document.getElementById('manage-categories-sheet-overlay');
  const manageCategoriesCloseBtn = document.getElementById('manage-categories-close-btn');
  const manageCategoriesList = document.getElementById('manage-categories-list');
  const addCategoryBtn = document.getElementById('add-category-btn');

  const addCategorySheetOverlay = document.getElementById('add-category-sheet-overlay');
  const addCategoryForm = document.getElementById('add-category-form');
  const addCategoryNameInput = document.getElementById('add-category-name-input');
  const addCategoryEmojiInput = document.getElementById('add-category-emoji-input');
  const addCategoryEmojiPresets = document.getElementById('add-category-emoji-presets');
  const addCategoryErrorEl = document.getElementById('add-category-error');
  const addCategoryCancelBtn = document.getElementById('add-category-cancel-btn');

  const deleteCategorySheetOverlay = document.getElementById('delete-category-sheet-overlay');
  const deleteCategoryMessageEl = document.getElementById('delete-category-message');
  const deleteCategoryCancelBtn = document.getElementById('delete-category-cancel-btn');
  const deleteCategoryConfirmBtn = document.getElementById('delete-category-confirm-btn');

  // Backup & Restore (v1.7) — the Settings row, its bottom sheet
  // (two actions: Backup Data / Restore Data), and the two nested
  // confirmation sheets. Same stacked-sheet shape as Manage
  // Categories/Add Category/Delete Category above.
  const openBackupRestoreBtn = document.getElementById('open-backup-restore-btn');
  const backupRestoreSheetOverlay = document.getElementById('backup-restore-sheet-overlay');
  const backupRestoreCloseBtn = document.getElementById('backup-restore-close-btn');
  const downloadBackupBtn = document.getElementById('download-backup-btn');
  const restoreBackupBtn = document.getElementById('restore-backup-btn');

  const backupConfirmSheetOverlay = document.getElementById('backup-confirm-sheet-overlay');
  const backupConfirmCancelBtn = document.getElementById('backup-confirm-cancel-btn');
  const backupConfirmDownloadBtn = document.getElementById('backup-confirm-download-btn');

  const restoreConfirmSheetOverlay = document.getElementById('restore-confirm-sheet-overlay');
  const restoreConfirmCancelBtn = document.getElementById('restore-confirm-cancel-btn');
  const restoreConfirmChooseFileBtn = document.getElementById('restore-confirm-choose-file-btn');
  const restoreFileInput = document.getElementById('restore-file-input');


  /* ================================================================
     2. APPLICATION STATE
     `expenses` and `budget` (declared in section 0, SHARED DATA
     LAYER, above) are the single source of truth for the whole app.
     The DOM is a rendered projection of this state — never the
     other way around. Nothing should ever exist only in the DOM.
     The rest of this app's in-memory-only state lives here.
     ================================================================ */

  // When not null, the Add Expense screen is being reused to edit
  // an existing expense (identified by id) rather than create a
  // new one. See PHASE 5.
  let editingExpenseId = null;

  // The id of the expense currently shown in the Expense Detail
  // bottom sheet (v1.4.0 — TASK 10), or null when the sheet is
  // closed. Set by openExpenseSheet(); read by its Edit/Delete
  // buttons so they always act on the expense actually on screen.
  let activeDetailExpenseId = null;

  // Remembers document.body's inline overflow value from before the
  // Expense Detail sheet locked background scrolling, so closing it
  // restores exactly what was there rather than assuming '' or
  // 'auto'. See openExpenseSheet()/closeExpenseSheet().
  let bodyOverflowBeforeSheet = '';

  // The active time filter (PHASE 7). Never touches `expenses`
  // itself — it only decides what applyCurrentFilter() returns.
  // Intentionally in-memory only; not persisted (see PHASE 6 note
  // in the LOCAL PERSISTENCE section). Defaults to 'all' (v1.0.1)
  // so Pebble always opens showing full history — a fresh "Today"
  // view tends to look empty on a new day, whereas "All" shows
  // history, categories, and charts right away. This has no effect
  // on the budget numbers above, which are always month-scoped
  // regardless of `currentFilter` (see calculateDashboardData()).
  let currentFilter = 'all';

  // The selected Custom range (PHASE 7.5), only meaningful when
  // currentFilter === 'custom'. Holds real Date objects (local
  // start-of-day / end-of-day), not strings — set only via a
  // validated Apply in the Custom Range sheet. Exactly like
  // `currentFilter`, this is in-memory only and never persisted;
  // the app always reopens with "All" selected.
  let customDateRange = {
    from: null,
    to: null
  };

  // The current search text (TASK 9), always applied on top of
  // whatever currentFilter/customDateRange already narrowed
  // `expenses` down to — never against the full `expenses` array
  // directly. Exactly like currentFilter/customDateRange above,
  // this is in-memory only and never persisted; the app always
  // reopens with an empty search.
  let searchQuery = '';

  // lastPaymentMethod, the category manager, PAYMENT_METHODS/
  // PAYMENT_METHOD_MAP, and currencyFormatter now live in section 0
  // (SHARED DATA LAYER) at the top of this file, so both index.html
  // and analytics.html can reach them. Only dateFormatter — used
  // exclusively by index.html's expense-card rendering — stays here.

  const dateFormatter = new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });


  /* ================================================================
     5. ID GENERATION
     ================================================================ */

  /**
   * Generates a unique identifier for a new expense. Prefers
   * crypto.randomUUID(); falls back to a timestamp-based id on
   * environments where it isn't available.
   * @returns {string}
   */
  function generateId() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return Date.now().toString();
  }

  /**
   * Rounds a monetary value to two decimal places before it's ever
   * stored. Purely a floating-point precision guard — it changes
   * nothing about how totals are calculated downstream, since
   * calculateDashboardData() just sums whatever is already sitting
   * in `expenses`.
   * @param {number} value
   * @returns {number}
   */
  function roundToTwoDecimals(value) {
    return Math.round(value * 100) / 100;
  }


  /* ================================================================
     6. NAVIGATION (PHASE 1)
     ================================================================ */

  /**
   * Reveals the Add Expense screen and hides the Home screen.
   */
  function showAddExpenseScreen() {
    homeScreen.classList.add('screen-hidden');
    addExpenseScreen.classList.remove('screen-hidden');
  }

  /**
   * Reveals the Home screen and hides the Add Expense screen.
   */
  function showHomeScreen() {
    addExpenseScreen.classList.add('screen-hidden');
    homeScreen.classList.remove('screen-hidden');
  }

  addExpenseFab.addEventListener('click', showAddExpenseScreen);
  backToHomeBtn.addEventListener('click', () => {
    showHomeScreen();
    resetForm();
  });


  /* ================================================================
     7. CATEGORY SELECTOR RENDERING (PHASE 3)
     ================================================================ */

  /**
   * Builds one category button from a category data object.
   * Structure mirrors the original static markup so existing CSS
   * (.category-btn, .category-icon, .category-name, the
   * per-category "-selected" color rules) keeps working untouched.
   * @param {{id: string, name: string, emoji: string}} category
   * @returns {HTMLButtonElement}
   */
  function createCategoryButton(category) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-btn';
    button.dataset.category = category.id;
    button.setAttribute('aria-label', category.name);
    // Fallback accent for custom categories, which have no matching
    // .category-btn[data-category="..."] rule in style.css (that
    // file only hardcodes Pebble's 8 defaults). See the low-
    // specificity fallback rule in style.css section 23 — it never
    // wins over the default rules, only applies where they don't
    // match.
    button.style.setProperty('--btn-accent', getCategoryColor(category.id));

    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.textContent = category.emoji;

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = category.name;

    button.append(icon, name);
    button.addEventListener('click', () => selectCategory(button));

    return button;
  }

  /**
   * Clears and rebuilds the category selector from the category
   * manager. Called once on load; safe to call again if categories
   * ever become dynamic (e.g. user-defined categories in a later
   * phase) — the dropdown always reflects getCategories() exactly.
   */
  function renderCategories() {
    categorySelector.innerHTML = '';
    getCategories().forEach((category) => {
      categorySelector.appendChild(createCategoryButton(category));
    });
  }

  /**
   * Selects a single category button, deselecting all others,
   * and syncs the hidden category input used for form submission.
   * @param {HTMLButtonElement} selectedBtn
   */
  function selectCategory(selectedBtn) {
    categorySelector.querySelectorAll('.category-btn').forEach((btn) => {
      btn.classList.remove('category-btn-selected');
    });

    selectedBtn.classList.add('category-btn-selected');
    categoryHiddenInput.value = selectedBtn.dataset.category;
  }


  /* ================================================================
     7B. PAYMENT METHOD SELECTOR (PHASE 11)
     The two Payment Method buttons are static markup in index.html
     (only two options, unlike the dynamically-generated category
     list), so this section only wires up selection behavior — the
     same select-one-deselect-rest pattern as selectCategory() above,
     reusing .category-btn-selected so the CSS in style.css that
     already exists for the shared .category-btn shell is reused
     untouched.
     ================================================================ */

  const paymentMethodButtons = paymentMethodSelector.querySelectorAll('.payment-btn');

  /**
   * Selects a single payment method button, deselecting all others,
   * and syncs the hidden paymentMethod input used for form
   * submission. Mirrors selectCategory() exactly.
   * @param {HTMLButtonElement} selectedBtn
   */
  function selectPaymentMethod(selectedBtn) {
    paymentMethodButtons.forEach((btn) => {
      btn.classList.remove('category-btn-selected');
    });

    selectedBtn.classList.add('category-btn-selected');
    paymentMethodHiddenInput.value = selectedBtn.dataset.paymentMethod;
  }

  /**
   * Programmatically selects a payment method by id (rather than by
   * button reference) — used whenever the form is preloaded instead
   * of clicked into: resetForm() (remembered selection), editing an
   * existing expense (its saved selection), and initial page load.
   * Falls back to 'digital' if the given id doesn't match a known
   * payment method (e.g. a corrupted/unrecognized value), so the
   * field is never left blank.
   * @param {string} methodId
   */
  function applyPaymentMethodSelection(methodId) {
    const resolvedId = PAYMENT_METHOD_MAP.has(methodId) ? methodId : 'digital';
    const matchingBtn = paymentMethodSelector.querySelector(
      `.payment-btn[data-payment-method="${resolvedId}"]`
    );
    if (matchingBtn) {
      selectPaymentMethod(matchingBtn);
    }
  }

  paymentMethodButtons.forEach((btn) => {
    btn.addEventListener('click', () => selectPaymentMethod(btn));
  });


  /* ================================================================
     8. AMOUNT INPUT VALIDATION (PHASE 2)
     ================================================================ */

  /**
   * Blocks the keystrokes that let a native number input accept
   * scientific notation or an explicit sign ('e', 'E', '+', '-').
   * Pebble doesn't support scientific notation, so these are
   * rejected at the keyboard level — before they ever reach the
   * field's value. Digits, the decimal point, backspace, delete,
   * arrow keys, tab, and modifier-key combos (copy/paste/select
   * all) are untouched, since none of them match this key list.
   * This is the first of three validation layers (keydown -> input
   * -> submit); it's a UX improvement, not the only guard.
   * @param {KeyboardEvent} event
   */
  function blockScientificNotationKeys(event) {
    if (['e', 'E', '+', '-'].includes(event.key)) {
      event.preventDefault();
    }
  }

  amountInput.addEventListener('keydown', blockScientificNotationKeys);
  budgetAmountInput.addEventListener('keydown', blockScientificNotationKeys);

  /**
   * Strips a pasted string down to digits and at most one decimal
   * point. Anything else — 'e'/'E', '+', '-', letters, symbols — is
   * discarded rather than repaired into a "closest valid" number,
   * so a paste like "1e5" becomes "15", not "100000".
   * @param {string} rawText
   * @returns {string}
   */
  function sanitizeNumericPaste(rawText) {
    let cleaned = rawText.replace(/[^0-9.]/g, '');
    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      cleaned = cleaned.slice(0, firstDotIndex + 1) +
        cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
    }
    return cleaned;
  }

  /**
   * Intercepts paste events on a numeric input so invalid content
   * (scientific notation, signs, stray text) can never land in the
   * field, even though the browser's native paste would otherwise
   * allow it straight past the keydown guard above. Replaces only
   * the selected range, mirroring normal paste behavior, then fires
   * a synthetic 'input' event so the existing negative-value guard
   * still runs against the result — this doesn't bypass that layer.
   * @param {ClipboardEvent} event
   */
  function handleNumericPaste(event) {
    event.preventDefault();
    const input = event.target;
    const clipboardText = (event.clipboardData || window.clipboardData).getData('text');
    const sanitized = sanitizeNumericPaste(clipboardText);
    if (sanitized === '') return;

    const start = input.selectionStart ?? input.value.length;
    const end = input.selectionEnd ?? input.value.length;
    input.value = input.value.slice(0, start) + sanitized + input.value.slice(end);

    const cursorPos = start + sanitized.length;
    input.setSelectionRange(cursorPos, cursorPos);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  amountInput.addEventListener('paste', handleNumericPaste);
  budgetAmountInput.addEventListener('paste', handleNumericPaste);

  /**
   * Prevents negative values from ever sitting in the amount field.
   * Zero/empty is still allowed at this stage; final enforcement
   * of ">0" happens on save. Second validation layer, behind the
   * keydown guard above and ahead of the submit-time check below.
   */
  amountInput.addEventListener('input', () => {
    if (amountInput.value !== '' && Number(amountInput.value) < 0) {
      amountInput.value = '';
    }
  });


  /* ================================================================
     9. FORM RESET (PHASE 2 + PHASE 11)
     ================================================================ */

  /**
   * Clears amount, category selection, and note back to defaults.
   * Also exits edit mode (if active) and restores the Add Expense
   * screen's default title/button label. Called after a successful
   * save and when navigating back. Payment Method (PHASE 11) is
   * reset to whatever was last selected/remembered, not cleared —
   * "remember last selection" means a fresh Add Expense should
   * already show it preselected, unlike amount/category/note which
   * genuinely reset to blank/none.
   */
  function resetForm() {
    addExpenseForm.reset();
    categoryHiddenInput.value = '';
    noteInput.value = '';
    categorySelector.querySelectorAll('.category-btn').forEach((btn) => {
      btn.classList.remove('category-btn-selected');
    });

    applyPaymentMethodSelection(lastPaymentMethod);

    editingExpenseId = null;
    addExpenseTitle.textContent = 'Add Expense';
    saveExpenseBtn.textContent = 'Save';
  }


  /* ================================================================
     10. EXPENSE CARD BUILDING (PHASE 3)
     Pure builder functions — they read an expense object and
     return DOM nodes. They never touch the `expenses` array or
     the live document themselves, so they stay easy to reuse for
     Edit previews, exports, etc. in later phases.
     ================================================================ */

  /**
   * Builds the three-dot menu attached to an expense card. Only
   * builds the markup — click handling (Edit/Delete) is wired up
   * by the caller (createExpenseCard) since it needs the specific
   * expense.id to act on.
   * @returns {HTMLDivElement}
   */
  function createMenu() {
    const menu = document.createElement('div');
    menu.className = 'expense-menu';
    menu.setAttribute('role', 'menu');
    menu.hidden = true;

    const editItem = document.createElement('button');
    editItem.type = 'button';
    editItem.className = 'expense-menu-item';
    editItem.setAttribute('role', 'menuitem');
    editItem.dataset.action = 'edit';
    editItem.textContent = 'Edit';

    const deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'expense-menu-item';
    deleteItem.setAttribute('role', 'menuitem');
    deleteItem.dataset.action = 'delete';
    deleteItem.textContent = 'Delete';

    menu.append(editItem, deleteItem);
    return menu;
  }

  /**
   * Closes every open expense menu, resetting their button's
   * aria-expanded state to "false".
   */
  function closeAllMenus() {
    document.querySelectorAll('.expense-menu').forEach((menu) => {
      menu.hidden = true;
    });
    document.querySelectorAll('.expense-menu-btn').forEach((btn) => {
      btn.setAttribute('aria-expanded', 'false');
    });
  }

  /**
   * Builds a single expense card element from an expense object.
   * Category icon color comes from the existing per-category CSS
   * rules (.expense-item[data-category="..."] .expense-category-icon),
   * keyed off data-category — nothing is hardcoded here.
   * @param {{id: string, amount: number, category: string, note: string, createdAt: string, paymentMethod?: string}} expense
   * @returns {HTMLLIElement}
   */
  function createExpenseCard(expense) {
    const categoryData = getCategoryById(expense.category);

    const item = document.createElement('li');
    item.className = 'expense-item';
    item.dataset.category = expense.category;
    item.dataset.expenseId = expense.id;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'expense-category-icon';
    icon.textContent = categoryData ? categoryData.emoji : '✨';
    icon.setAttribute('aria-hidden', 'true');
    // Fallback accent for custom categories — see the matching note
    // in createCategoryButton() above and style.css section 23.
    icon.style.setProperty('--icon-accent', getCategoryColor(expense.category));

    // Name + optional note + timestamp
    const details = document.createElement('div');
    details.className = 'expense-details';

    const name = document.createElement('p');
    name.className = 'expense-category-name';
    name.textContent = categoryData ? categoryData.name : 'Others';
    details.appendChild(name);

    if (expense.note) {
      const note = document.createElement('p');
      note.className = 'expense-note';
      note.textContent = expense.note;
      details.appendChild(note);
    }

    const timestamp = document.createElement('p');
    timestamp.className = 'expense-note';
    const formattedDate = dateFormatter.format(new Date(expense.createdAt));
    const paymentMethodData = PAYMENT_METHOD_MAP.get(expense.paymentMethod);
    timestamp.textContent = paymentMethodData
      ? `${paymentMethodData.icon} ${paymentMethodData.name} • ${formattedDate}`
      : formattedDate;
    details.appendChild(timestamp);

    // Amount
    const amount = document.createElement('p');
    amount.className = 'expense-amount';
    amount.textContent = currencyFormatter.format(expense.amount);

    // Three-dot menu button + menu
    const menuBtn = document.createElement('button');
    menuBtn.type = 'button';
    menuBtn.className = 'expense-menu-btn';
    menuBtn.setAttribute('aria-label', 'Expense options');
    menuBtn.setAttribute('aria-haspopup', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');

    const menuIcon = document.createElement('span');
    menuIcon.className = 'expense-menu-icon';
    menuIcon.textContent = '⋮';
    menuBtn.appendChild(menuIcon);

    const menu = createMenu();

    // Single delegated listener for both menu items — reads the
    // action off data-action rather than binding two separate
    // closures, and always identifies the expense by expense.id.
    menu.addEventListener('click', (event) => {
      const actionBtn = event.target.closest('.expense-menu-item');
      if (!actionBtn) return;
      event.stopPropagation();

      closeAllMenus();

      if (actionBtn.dataset.action === 'edit') {
        startEditExpense(expense.id);
      } else if (actionBtn.dataset.action === 'delete') {
        deleteExpense(expense.id);
      }
    });

    menuBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      const willOpen = menu.hidden;
      closeAllMenus();
      menu.hidden = !willOpen;
      menuBtn.setAttribute('aria-expanded', String(willOpen));
    });

    // Tapping the card (v1.4.0 — TASK 10) opens the Expense Detail
    // sheet. menuBtn's and menu's own click handlers above already
    // call event.stopPropagation(), so this never fires for taps on
    // the three-dot menu or its Edit/Delete items — only genuine
    // taps on the card body reach here.
    item.addEventListener('click', () => {
      openExpenseSheet(expense.id);
    });

    item.append(icon, details, amount, menuBtn, menu);
    return item;
  }


  /* ================================================================
     11. RENDERING FROM STATE (REFINEMENT)
     The DOM is never patched piecemeal after a save. Instead,
     renderExpenses() rebuilds the entire history list from the
     `expenses` array every time it's called, so the UI can never
     drift out of sync with the data.
     ================================================================ */

  /**
   * The two messages #expense-history-empty can show (TASK 9.1) —
   * kept as the exact same markup/classes the element already had,
   * just swapped in dynamically instead of always being the
   * "no expenses yet" copy. No second empty-state element is
   * introduced; this is still the one existing component.
   */
  const EMPTY_STATE_NO_EXPENSES_HTML = `
        <strong>No expenses yet.</strong><br>
        Start by tapping the <strong>＋</strong> button below.
      `;
  const EMPTY_STATE_NO_MATCHES_HTML = `
        <strong>No matching expenses found.</strong><br>
        Try another keyword or clear the search.
      `;

  /**
   * Shows the empty state when the given (post-search) list is
   * empty, hides it otherwise. Reflects whatever list
   * renderExpenses() was given — so filtering into an empty result
   * correctly shows the empty state even if `expenses` itself isn't
   * empty.
   *
   * `hasDateFilteredResults` (TASK 9.1) is what tells the two empty
   * causes apart: applyCurrentFilter() already narrowed `expenses`
   * down to the active date filter before applySearchFilter() ever
   * ran, so if that date-filtered set had entries and the list
   * we're rendering is still empty, it was the search that emptied
   * it out — not a genuine absence of expenses. Only then does the
   * copy change; a genuinely empty date filter keeps the original
   * "No expenses yet" message unchanged.
   * @param {Array} expenseList
   * @param {boolean} [hasDateFilteredResults=false]
   */
  function toggleEmptyState(expenseList, hasDateFilteredResults = false) {
    const isEmpty = expenseList.length === 0;
    expenseHistoryEmpty.hidden = !isEmpty;

    if (!isEmpty) return;

    expenseHistoryEmpty.innerHTML = hasDateFilteredResults
      ? EMPTY_STATE_NO_MATCHES_HTML
      : EMPTY_STATE_NO_EXPENSES_HTML;
  }

  /**
   * Rebuilds the expense history list from whichever expense list
   * it's given. Defaults to the full `expenses` array so existing
   * callers that don't care about filtering keep working unchanged.
   * This function has no idea whether its input is filtered — that
   * decision belongs entirely to applyCurrentFilter() (PHASE 7).
   * Newest expenses are shown first without needing to store them
   * in reverse order — the underlying array itself stays in the
   * order expenses were created, which is what persistence/sync
   * layers expect.
   * @param {Array} [expenseList=expenses]
   * @param {boolean} [hasDateFilteredResults=false] see toggleEmptyState() (TASK 9.1)
   */
  function renderExpenses(expenseList = expenses, hasDateFilteredResults = false) {
    expenseHistoryList.innerHTML = '';

    [...expenseList]
      .reverse()
      .forEach((expense) => {
        expenseHistoryList.appendChild(createExpenseCard(expense));
      });

    toggleEmptyState(expenseList, hasDateFilteredResults);
  }

  // Close any open three-dot menu when clicking outside of it.
  document.addEventListener('click', closeAllMenus);


  /* ================================================================
     12. DASHBOARD CALCULATION LAYER (PHASE 4)
     One function, one job: turn `expenses` + `budget` into every
     number the dashboard needs. It never touches the DOM. Every
     render function below reads from its return value instead of
     recalculating anything itself — so there is exactly one place
     where "total spent" or "remaining budget" is defined.

     This is what makes future Edit/Delete/Filter features safe:
     they only need to mutate `expenses` (or `budget`) and call
     updateDashboard() again. Nothing here assumes expenses were
     only ever added — deleting or editing an entry and recomputing
     from scratch works identically.
     ================================================================ */

  /**
   * Returns only the expenses that fall within the current calendar
   * month (local time), regardless of `currentFilter`. This is the
   * one place "this month" is defined for budget purposes — the
   * history filters (Today/Week/Year/All/Custom) have their own,
   * separate definition in getFilterStartDate() and must never be
   * confused with this one.
   * @param {Array} expenseList
   * @returns {Array}
   */
  function getCurrentMonthExpenses(expenseList) {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);

    return expenseList.filter((expense) => new Date(expense.createdAt) >= monthStart);
  }

  /**
   * Derives the full set of dashboard data from a list of expenses
   * and a budget. Accepts `expenses` as a parameter (rather than
   * closing over the outer array directly) so that a *filtered*
   * array can be passed in later without changing this function.
   *
   * IMPORTANT: `expenseList` is filtered down to the current
   * calendar month right here, before anything else is computed.
   * History filters (Today/Week/Year/All/Custom) are purely visual
   * — they decide what the expense list below shows — and must
   * never change what the budget thinks has been spent. Callers
   * always pass the full `expenses` array in; this is the one
   * place "this month" is defined.
   * @param {Array<{id:string, amount:number, category:string}>} expenseList
   * @param {number} budgetAmount
   * @returns {{
   *   totalSpent: number,
   *   remainingBudget: number,
   *   spendingPercentage: number,
   *   budget: number,
   *   categoryBreakdown: Array<{id:string,name:string,icon:string,amount:number,percentOfBudget:number,percentOfSpent:number}>
   * }}
   */
  function calculateDashboardData(expenseList, budgetAmount) {
    const monthExpenses = getCurrentMonthExpenses(expenseList);

    // ---- Total spent: always summed fresh, never incremented. ----
    const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);

    // ---- Remaining budget: always (budget - totalSpent). ----
    const remainingBudget = budgetAmount - totalSpent;

    // ---- Budget usage percentage, clamped to 100 for display. ----
    const spendingPercentage = budgetAmount > 0
      ? Math.min((totalSpent / budgetAmount) * 100, 100)
      : 0;

    // ---- Category totals: single pass over the expense list. ----
    const categoryTotals = new Map();
    monthExpenses.forEach((expense) => {
      const current = categoryTotals.get(expense.category) || 0;
      categoryTotals.set(expense.category, current + expense.amount);
    });

    // ---- Category breakdown: only categories with spending,      ----
    // ---- sorted highest first. Percentages of both budget and    ----
    // ---- total spent are precomputed here so no consumer (bar,   ----
    // ---- summary, chart) ever recalculates a percentage itself.  ----
    const categoryBreakdown = getCategories()
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.emoji,
        amount: categoryTotals.get(category.id) || 0
      }))
      .filter((category) => category.amount > 0)
      .sort((a, b) => b.amount - a.amount)
      .map((category) => ({
        ...category,
        percentOfBudget: budgetAmount > 0 ? (category.amount / budgetAmount) * 100 : 0,
        percentOfSpent: totalSpent > 0 ? (category.amount / totalSpent) * 100 : 0
      }));

    return {
      totalSpent,
      remainingBudget,
      spendingPercentage,
      budget: budgetAmount,
      categoryBreakdown
    };
  }


  /* ================================================================
     13. DASHBOARD RENDERING (PHASE 4)
     Each function below owns exactly one piece of UI and reads
     only from the dashboardData object it's given — never from
     `expenses` or `budget` directly. This keeps calculation and
     rendering fully separated.

     getCategoryColor() now lives in section 0 (SHARED DATA LAYER),
     alongside the rest of the category manager, so analytics.html's Category Breakdown
     (TASK 5) can reuse it too instead of re-resolving category CSS
     variables its own way.
     ================================================================ */

  /**
   * Renders the Monthly Spending and Remaining Budget cards.
   * @param {ReturnType<typeof calculateDashboardData>} dashboardData
   */
  function renderBudget(dashboardData) {
    monthlySpendingAmountEl.textContent = currencyFormatter.format(dashboardData.totalSpent);
    remainingBudgetAmountEl.textContent = currencyFormatter.format(dashboardData.remainingBudget);
  }

  /**
   * Renders the single stacked horizontal progress bar. Each
   * category gets one segment whose width is (category amount /
   * budget) — never (category amount / total spent) — so the bar
   * only fills completely once the whole budget is used. Unused
   * budget is simply the untouched track background; no "empty"
   * element is needed.
   * @param {ReturnType<typeof calculateDashboardData>} dashboardData
   */
  function renderProgressBar(dashboardData) {
    budgetProgressTrack.innerHTML = '';

    // Lay segments out left-to-right with no gaps between them.
    budgetProgressTrack.style.whiteSpace = 'nowrap';
    budgetProgressTrack.style.fontSize = '0';

    dashboardData.categoryBreakdown.forEach((category) => {
      const segment = document.createElement('span');
      segment.className = 'progress-segment';
      segment.dataset.category = category.id;
      segment.style.display = 'inline-block';
      segment.style.height = '100%';
      segment.style.verticalAlign = 'top';
      segment.style.width = `${category.percentOfBudget}%`;
      segment.style.backgroundColor = getCategoryColor(category.id);
      budgetProgressTrack.appendChild(segment);
    });

    // Keep the progressbar's accessible value in sync with reality.
    budgetProgressTrack.setAttribute('aria-valuemin', '0');
    budgetProgressTrack.setAttribute('aria-valuemax', '100');
    budgetProgressTrack.setAttribute(
      'aria-valuenow',
      String(Math.round(dashboardData.spendingPercentage))
    );
  }

  /**
   * Renders the category summary list. Reuses the same
   * categoryBreakdown the progress bar and chart use — the sort
   * order (highest spend first) and every amount are calculated
   * exactly once, in calculateDashboardData().
   * @param {ReturnType<typeof calculateDashboardData>} dashboardData
   */
  function renderCategorySummary(dashboardData) {
    categorySummaryList.innerHTML = '';

    dashboardData.categoryBreakdown.forEach((category) => {
      const row = document.createElement('li');
      row.className = 'category-summary-row';
      row.dataset.category = category.id;

      const nameWrap = document.createElement('span');
      nameWrap.className = 'category-summary-name';

      const dot = document.createElement('span');
      dot.className = 'category-summary-dot';
      dot.style.backgroundColor = getCategoryColor(category.id);

      const name = document.createElement('span');
      name.textContent = `${category.icon} ${category.name}`;

      nameWrap.append(dot, name);

      const amount = document.createElement('span');
      amount.className = 'category-summary-amount';
      amount.textContent = currencyFormatter.format(category.amount);

      row.append(nameWrap, amount);
      categorySummaryList.appendChild(row);
    });
  }

  // Chart instance is kept here so subsequent renders can update it
  // in place (see renderChart) instead of destroying and rebuilding
  // a new Chart.js instance on the same canvas every time the
  // dashboard refreshes.
  let spendingChart = null;

  /**
   * Renders (or re-renders) the category pie chart using Chart.js.
   * Consumes the same categoryBreakdown as the bar and summary —
   * no separate data preparation happens here.
   * @param {ReturnType<typeof calculateDashboardData>} dashboardData
   */
  function renderChart(dashboardData) {
    if (typeof Chart === 'undefined' || !spendingChartCanvas) return;

    const labels = dashboardData.categoryBreakdown.map((category) => category.name);
    const values = dashboardData.categoryBreakdown.map((category) => category.amount);
    const colors = dashboardData.categoryBreakdown.map((category) => getCategoryColor(category.id));

    if (spendingChart) {
      // Update the existing instance in place instead of destroying
      // and constructing a new one. Root cause of the stretching bug:
      // destroy() + new Chart() forces Chart.js to remeasure the
      // canvas from scratch on every dashboard refresh. If that
      // remeasurement runs while the surrounding DOM (category list,
      // progress bar) is still settling from the same update, it can
      // capture a transient, non-square size — which then persists
      // until something else (like a page reload, which starts from
      // a pristine layout) forces a fresh measurement. Reusing the
      // instance and calling update() avoids re-measuring the canvas
      // at all; Chart.js's own responsive handling keeps it correct.
      spendingChart.data.labels = labels;
      spendingChart.data.datasets[0].data = values;
      spendingChart.data.datasets[0].backgroundColor = colors;
      spendingChart.update();
      return;
    }

    spendingChart = new Chart(spendingChartCanvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data: values,
          backgroundColor: colors,
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false }
        }
      }
    });
  }

  /**
   * Single entry point for refreshing dashboard numbers. Always
   * pass the full `expenses` array — calculateDashboardData() is
   * responsible for narrowing that down to the current calendar
   * month, so the budget numbers stay correct no matter what the
   * history filter is currently set to. Defaults to the full
   * `expenses` array so existing callers keep working unchanged.
   * Any future feature that changes data (delete, edit, filter,
   * budget update) should only touch state and then call this —
   * nothing else.
   * @param {Array} [expenseList=expenses]
   */
  function updateDashboard(expenseList = expenses) {
    const dashboardData = calculateDashboardData(expenseList, budget);
    renderBudget(dashboardData);
    renderProgressBar(dashboardData);
    renderCategorySummary(dashboardData);
    renderChart(dashboardData);
  }


  /* ================================================================
     14. BUDGET BOTTOM SHEET (PHASE 4 + PHASE 6)
     UI-level integration: opens/closes the existing bottom sheet
     markup and updates the in-memory `budget` variable. Saving now
     also persists via saveState() (PHASE 6) — same mutation
     pattern as every other state change.
     ================================================================ */

  function openBudgetSheet() {
    budgetAmountInput.value = budget;
    budgetSheetOverlay.hidden = false;
    budgetSheetOverlay.classList.remove('sheet-hidden');
    budgetAmountInput.focus();
  }

  function closeBudgetSheet() {
    budgetSheetOverlay.classList.add('sheet-hidden');
    // Wait for the slide-down transition before removing from the
    // accessibility tree / layout.
    window.setTimeout(() => {
      budgetSheetOverlay.hidden = true;
    }, 220);
  }

  remainingBudgetCard.addEventListener('click', openBudgetSheet);

  // The card is role="button" + tabindex="0", so it also needs to
  // respond to keyboard activation, not just clicks.
  remainingBudgetCard.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openBudgetSheet();
    }
  });

  budgetCancelBtn.addEventListener('click', closeBudgetSheet);

  budgetSheetForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const newBudget = parseFloat(budgetAmountInput.value);
    if (isNaN(newBudget) || newBudget < 0) {
      alert('Please enter a valid budget.');
      return;
    }

    budget = newBudget;
    saveState();
    updateDashboard(expenses);
    closeBudgetSheet();
  });


  /* ================================================================
     15. EXPENSE MANAGEMENT — EDIT & DELETE (PHASE 5 + PHASE 11)
     Expenses are always located by expense.id — never by array
     index, amount, category, or note, since any of those can
     collide or change. Every mutation here ends the same way:
     update `expenses`, then call renderExpenses() + updateDashboard().
     No dashboard number is ever touched directly.
     ================================================================ */

  /**
   * Finds an expense by its unique id. The single lookup path used
   * by both Edit and Delete, so there's exactly one place that
   * defines "how an expense is located."
   * @param {string} id
   * @returns {object|undefined}
   */
  function findExpenseById(id) {
    return expenses.find((expense) => expense.id === id);
  }

  /**
   * Deletes an expense after confirmation. Removes it from
   * `expenses` by id (never by index — the index is looked up
   * fresh right before splicing, so it can't go stale), then lets
   * renderExpenses()/updateDashboard() rebuild everything from the
   * updated array. No dashboard value is adjusted by hand.
   * @param {string} id
   * @returns {boolean} true if the expense was actually deleted
   *   (i.e. the confirmation was accepted), false otherwise — lets
   *   callers like the Expense Detail sheet (v1.4.0 — TASK 10) know
   *   whether to close themselves or stay open after a cancel.
   */
  function deleteExpense(id) {
    const confirmed = window.confirm(
      'Delete this expense?\n\nThis action cannot be undone.'
    );
    if (!confirmed) return false;

    const index = expenses.findIndex((expense) => expense.id === id);
    if (index === -1) return false;

    expenses.splice(index, 1);

    saveState();
    evaluateBudgetAlerts();
    refreshUI();
    return true;
  }

  /**
   * Enters edit mode for an existing expense: preloads the Add
   * Expense screen with its amount, category, note, and payment
   * method, relabels the screen so it's clear this is an edit
   * rather than a new entry, and remembers the id being edited so
   * the submit handler knows to update instead of create.
   *
   * PHASE 11: older expenses saved before Payment Method existed
   * have no `paymentMethod` field. Rather than leaving the selector
   * in a blank/invalid state, this falls back to whatever was most
   * recently remembered (`lastPaymentMethod`), or 'digital' if
   * nothing has ever been remembered either — the same fallback
   * chain applyPaymentMethodSelection() already implements.
   * @param {string} id
   */
  function startEditExpense(id) {
    const expense = findExpenseById(id);
    if (!expense) return;

    editingExpenseId = id;

    amountInput.value = expense.amount;
    noteInput.value = expense.note || '';

    const categoryBtn = categorySelector.querySelector(
      `.category-btn[data-category="${expense.category}"]`
    );
    if (categoryBtn) {
      selectCategory(categoryBtn);
    }

    applyPaymentMethodSelection(expense.paymentMethod || lastPaymentMethod);

    addExpenseTitle.textContent = 'Edit Expense';
    saveExpenseBtn.textContent = 'Save Changes';

    showAddExpenseScreen();
  }


  /* ================================================================
     15.5 EXPENSE DETAIL BOTTOM SHEET (v1.4.0 — TASK 10)
     A reusable UI component, not a rewrite of the expense list.
     Tapping any expense card opens it; it shows the complete detail
     of that one expense; Edit/Delete inside it call the existing
     startEditExpense()/deleteExpense() by id — nothing here
     duplicates that logic or holds its own copy of the expense.
     Four separate responsibilities, same convention as the rest of
     this file (one calculation/render/update per feature):
       - populateExpenseSheet() : fills the sheet's DOM from an expense
       - openExpenseSheet()     : looks the expense up, populates, shows
       - closeExpenseSheet()    : hides, restores scroll/focus
       - attachExpenseSheetEvents() : wires dismissal + Edit/Delete,
                                       called once at init
     ================================================================ */

  const EXPENSE_DETAIL_SHEET_TRANSITION_MS = 280;

  /**
   * Fills the sheet's DOM from a single expense object. Reads only
   * from the expense passed in plus the same category manager /
   * PAYMENT_METHOD_MAP / currencyFormatter / dateFormatter
   * createExpenseCard() already uses — no new formatting rules, no
   * duplicate expense object is created.
   * @param {object} expense
   */
  function populateExpenseSheet(expense) {
    const categoryData = getCategoryById(expense.category);
    const paymentMethodData = PAYMENT_METHOD_MAP.get(expense.paymentMethod);
    const createdAt = new Date(expense.createdAt);

    expenseDetailIconEl.textContent = categoryData ? categoryData.emoji : '✨';
    expenseDetailCategoryEl.textContent = categoryData ? categoryData.name : 'Others';
    expenseDetailAmountEl.textContent = currencyFormatter.format(expense.amount);

    expenseDetailPaymentEl.textContent = paymentMethodData
      ? `${paymentMethodData.icon} ${paymentMethodData.name}`
      : '—';

    expenseDetailDateEl.textContent = createdAt.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
    expenseDetailTimeEl.textContent = createdAt.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    // Note card: only shown when a note actually exists — no empty
    // note section is ever rendered (same hidden-attribute pattern
    // as #expense-history-empty / #analytics-categories-empty).
    if (expense.note) {
      expenseDetailNoteText.textContent = expense.note;
      expenseDetailNoteCard.hidden = false;
    } else {
      expenseDetailNoteText.textContent = '';
      expenseDetailNoteCard.hidden = true;
    }

    // Budget Impact: architecture is ready (the row + its value
    // span already exist in the markup, hidden) but there is no
    // defined per-expense budget correlation yet, so it's never
    // un-hidden here. A future task can populate
    // #expense-detail-budget-impact-value and flip `hidden = false`
    // right here without touching anything else in this function.
  }

  /**
   * Opens the Expense Detail sheet for a given expense id: looks it
   * up via the same findExpenseById() Edit/Delete already use,
   * populates the sheet, locks background scrolling, and slides the
   * sheet up. Silently does nothing if the id can't be found (e.g.
   * stale reference after a concurrent delete).
   * @param {string} id
   */
  function openExpenseSheet(id) {
    const expense = findExpenseById(id);
    if (!expense) return;

    activeDetailExpenseId = id;
    populateExpenseSheet(expense);

    bodyOverflowBeforeSheet = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    expenseDetailSheetOverlay.hidden = false;
    // Force a reflow before removing the hidden class so the
    // slide-up transition actually runs instead of jumping straight
    // to its open state — same technique openSettingsPanel() uses.
    void expenseDetailSheetOverlay.offsetWidth;
    expenseDetailSheetOverlay.classList.remove('sheet-hidden');

    // Moves focus into the sheet for keyboard accessibility.
    expenseDetailCloseBtn.focus();
  }

  /**
   * Closes the Expense Detail sheet: slides it down, restores
   * background scrolling to whatever it was before opening, and —
   * after the slide-down transition finishes — hides it from
   * layout/the accessibility tree and forgets which expense it was
   * showing.
   */
  function closeExpenseSheet() {
    expenseDetailSheetOverlay.classList.add('sheet-hidden');
    document.body.style.overflow = bodyOverflowBeforeSheet;

    window.setTimeout(() => {
      expenseDetailSheetOverlay.hidden = true;
      activeDetailExpenseId = null;
    }, EXPENSE_DETAIL_SHEET_TRANSITION_MS);
  }

  /**
   * Wires every way the sheet can be dismissed or acted on. Called
   * once at init (section 22) — createExpenseCard() only ever calls
   * openExpenseSheet(), never re-attaches these.
   */
  function attachExpenseSheetEvents() {
    expenseDetailCloseBtn.addEventListener('click', closeExpenseSheet);

    // Tapping the dimmed backdrop closes it — a click only lands on
    // the overlay itself when it didn't land on the sheet (or
    // anything inside it), same pattern as the Settings panel.
    expenseDetailSheetOverlay.addEventListener('click', (event) => {
      if (event.target === expenseDetailSheetOverlay) {
        closeExpenseSheet();
      }
    });

    // Escape closes it, but only while it's actually open — this
    // listener is always attached, so it checks state itself rather
    // than being added/removed on open/close (same as the Settings
    // panel's Escape handler).
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !expenseDetailSheetOverlay.hidden) {
        closeExpenseSheet();
      }
    });

    // Edit: close the sheet, then hand off to the exact same
    // startEditExpense() the three-dot menu uses — no duplicated
    // form-preload logic.
    expenseDetailEditBtn.addEventListener('click', () => {
      if (!activeDetailExpenseId) return;
      const id = activeDetailExpenseId;
      closeExpenseSheet();
      startEditExpense(id);
    });

    // Delete: hand off to the exact same deleteExpense() the
    // three-dot menu uses. Its confirm() dialog runs first — the
    // sheet only closes if that was accepted (deleteExpense()
    // returns true), so cancelling leaves the sheet open exactly as
    // the person left it.
    expenseDetailDeleteBtn.addEventListener('click', () => {
      if (!activeDetailExpenseId) return;
      const wasDeleted = deleteExpense(activeDetailExpenseId);
      if (wasDeleted) {
        closeExpenseSheet();
      }
    });
  }


  /* ================================================================
     16. FORM SUBMISSION (PHASE 2 + PHASE 3 + REFINEMENT + PHASE 4 + PHASE 5 + PHASE 11)
     ================================================================ */

  addExpenseForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const amountValue = parseFloat(amountInput.value);
    const categoryValue = categoryHiddenInput.value;
    const paymentMethodValue = paymentMethodHiddenInput.value;

    // ---- Validation ----
    if (isNaN(amountValue) || amountInput.value === '') {
      alert('Please enter an amount.');
      return;
    }

    if (amountValue <= 0) {
      alert('Amount must be greater than zero.');
      return;
    }

    if (!categoryValue) {
      alert('Please select a category.');
      return;
    }

    if (!PAYMENT_METHOD_MAP.has(paymentMethodValue)) {
      alert('Please select a payment method.');
      return;
    }

    // Captured before resetForm() clears editingExpenseId below, so
    // the toast fired after navigation still knows which flow ran.
    const wasEditing = Boolean(editingExpenseId);

    if (editingExpenseId) {
      // ---- Edit path: update fields in place. id and createdAt ----
      // ---- are intentionally left untouched.                   ----
      const expense = findExpenseById(editingExpenseId);
      if (expense) {
        expense.amount = roundToTwoDecimals(amountValue);
        expense.category = categoryValue;
        expense.note = noteInput.value.trim();
        expense.paymentMethod = paymentMethodValue;
      }
    } else {
      // ---- Create path ----
      const expense = {
        id: generateId(),
        amount: roundToTwoDecimals(amountValue),
        category: categoryValue,
        note: noteInput.value.trim(),
        createdAt: new Date().toISOString(),
        paymentMethod: paymentMethodValue
      };
      expenses.push(expense);
    }

    // ---- Remember this payment method for next time (PHASE 11) ----
    lastPaymentMethod = paymentMethodValue;

    // ---- Update memory first, then persist, then re-render ----
    saveState();
    // delayFirstToast: true — waits for the Expense Saved/Updated
    // toast below to fully finish before any budget-alert toast
    // starts, so the two never compete over showToast()'s timers.
    evaluateBudgetAlerts({ delayFirstToast: true });
    refreshUI();
    resetForm();
    showHomeScreen();

    // ---- Success toast (PHASE 21) ----
    // Fired after the Home screen is already showing, not during
    // the screen transition, so it never appears to animate "with"
    // the navigation itself.
    window.setTimeout(() => {
      showToast('success', wasEditing ? 'Expense Updated' : 'Expense Saved');
    }, 120);
  });


  /* ================================================================
     17. LOCAL PERSISTENCE (PHASE 6 + PHASE 11)
     LocalStorage is storage, not state. `expenses`, `budget`, and
     `lastPaymentMethod` remain the single source of truth in memory
     at all times — this section only ever reads them (to save) or
     writes into them (to load). Nothing here renders anything or is
     read from directly by any render function.

     Flow:
       Startup      -> loadState() populates expenses + budget +
                        lastPaymentMethod
       User change  -> mutation updates memory -> saveState() ->
                        renderExpenses() -> updateDashboard()
     ================================================================ */

  // STORAGE_KEY, isValidExpense(), and loadState() now live in
  // section 0 (SHARED DATA LAYER) at the top of this file, so both
  // index.html and analytics.html can reach them. saveState() and
  // clearState() below still reference the same `expenses`/`budget`/
  // `lastPaymentMethod`/STORAGE_KEY — nothing about them changes.

  /**
   * Persists the current in-memory `budget`, `expenses`, and
   * `lastPaymentMethod` to LocalStorage. Saves nothing else. Called
   * after every successful mutation (add, edit, delete, budget
   * change) — never on its own as a substitute for updating memory
   * first.
   */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ budget, expenses, lastPaymentMethod }));
    } catch (error) {
      console.error('Pebble: failed to save data.', error);
    }
  }

  /**
   * Utility only — clears persisted state from LocalStorage. Not
   * wired to any UI yet; a future Settings page will call this.
   */
  function clearState() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Pebble: failed to clear saved data.', error);
    }
  }


  /* ================================================================
     18. EXPENSE FILTERING (PHASE 7 + PHASE 7.5 + TASK 9)
     `expenses` is never filtered in place — it stays the single
     source of truth, untouched. This section's only job is to
     decide, from `currentFilter` (and, for Custom, `customDateRange`)
     plus `searchQuery`, which subset of `expenses` should currently
     be displayed, and to refresh the UI with that subset.

     Flow:
       expenses (master array)
             │
             ▼
       currentFilter
             │
             ▼
       applyCurrentFilter()      ── date/range filter
             │
             ▼
       dateFilteredExpenses
             │
             ▼
       searchQuery
             │
             ▼
       applySearchFilter()       ── search filter (TASK 9)
             │
             ▼
       filteredExpenses
             │
             └── renderExpenses(filteredExpenses)

     Search is one extra step bolted onto the end of the existing
     pipeline, never a second/duplicate filtering path — it only
     ever narrows whatever applyCurrentFilter() already returned, so
     it's mechanically impossible for a search to reach outside the
     active date filter (e.g. searching "pizza" under "This Month"
     can only search this month's expenses; only under "All" does it
     search the entire `expenses` array).

     updateDashboard() (PHASE 3/4) always receives the full
     `expenses` array, never filteredExpenses — the history filter
     (and, now, search) are purely visual and only ever decide what
     the expense list below shows (PHASE 12 makes
     calculateDashboardData() the one place "this month" is defined
     for budget purposes). The Custom filter (PHASE 7.5) is not a
     special case anywhere else in the app: it just makes
     applyCurrentFilter() check an upper bound as well as a lower
     one.
     ================================================================ */

  /**
   * Returns the start-of-range Date for a given filter id, in
   * local time. Returns null for 'all' (or any unrecognized id),
   * meaning "no lower bound — include everything."
   *
   * This is the ONE place that defines what each time filter's
   * lower bound means. Adding a future filter (e.g. "Last 7 Days")
   * only requires adding one more case here — no rendering code
   * changes.
   * @param {string} filterId
   * @returns {Date|null}
   */
  function getFilterStartDate(filterId) {
    const now = new Date();

    switch (filterId) {
      case 'today': {
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        return start;
      }

      case 'week': {
        // Week starts on Monday. getDay(): 0=Sun, 1=Mon, ... 6=Sat.
        const start = new Date(now);
        start.setHours(0, 0, 0, 0);
        const day = start.getDay();
        const daysSinceMonday = (day === 0) ? 6 : day - 1;
        start.setDate(start.getDate() - daysSinceMonday);
        return start;
      }

      case 'month': {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        start.setHours(0, 0, 0, 0);
        return start;
      }

      case 'year': {
        const start = new Date(now.getFullYear(), 0, 1);
        start.setHours(0, 0, 0, 0);
        return start;
      }

      case 'custom':
        return customDateRange.from;

      case 'all':
      default:
        return null;
    }
  }

  /**
   * Returns the end-of-range Date for a given filter id, in local
   * time. Every built-in filter (Today/Week/Month/Year/All) has no
   * upper bound — they always run through "now" — so this returns
   * null for all of them. Only 'custom' (PHASE 7.5) has a real
   * upper bound. Kept as a separate sibling function rather than
   * folded into getFilterStartDate() so that function's existing
   * signature and every one of its current callers stay untouched.
   * @param {string} filterId
   * @returns {Date|null}
   */
  function getFilterEndDate(filterId) {
    if (filterId === 'custom') return customDateRange.to;
    return null;
  }

  /**
   * Filters a list of expenses down to the ones belonging to
   * `currentFilter`, using each expense's existing `createdAt`
   * field — no new timestamp is introduced or stored. Returns a
   * new array; never mutates the list it's given. Checks a lower
   * bound (all filters) and, only for 'custom', an upper bound too.
   * @param {Array} expenseList
   * @returns {Array}
   */
  function applyCurrentFilter(expenseList) {
    const startDate = getFilterStartDate(currentFilter);
    const endDate = getFilterEndDate(currentFilter);

    if (!startDate && !endDate) return expenseList; // 'all' — nothing to exclude.

    return expenseList.filter((expense) => {
      const createdAt = new Date(expense.createdAt);
      if (startDate && createdAt < startDate) return false;
      if (endDate && createdAt > endDate) return false;
      return true;
    });
  }

  /**
   * Narrows a list of expenses down to the ones matching
   * `searchQuery` (TASK 9, extended by TASK 9.1) — case-insensitive,
   * matching against the expense's title (the category name shown
   * on its card), note, category name, payment method name, and now
   * amount (both the raw number and the currencyFormatter-formatted
   * string, so "470", "1200", and partial digits like "12" all match
   * ₹470 / ₹1,200 the same way createExpenseCard() would display
   * them). Reuses the same category manager / PAYMENT_METHOD_MAP /
   * currencyFormatter createExpenseCard() already uses, so a match
   * here is always something the user can actually see on the card.
   * Returns the same array unchanged when there's no query — never
   * a special "search mode" the rest of the pipeline has to know
   * about. Never mutates the list it's given, and never looks at
   * `expenses` directly — it only ever receives whatever
   * applyCurrentFilter() already narrowed things down to, which is
   * what keeps a search scoped to the active date filter instead of
   * the whole database.
   * @param {Array} expenseList
   * @returns {Array}
   */
  function applySearchFilter(expenseList) {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return expenseList;

    return expenseList.filter((expense) => {
      const categoryData = getCategoryById(expense.category);
      const paymentMethodData = PAYMENT_METHOD_MAP.get(expense.paymentMethod);

      const searchableFields = [
        categoryData ? categoryData.name : '',
        expense.note || '',
        paymentMethodData ? paymentMethodData.name : '',
        expense.amount.toString(),
        currencyFormatter.format(expense.amount)
      ];

      return searchableFields.some((field) => field.toLowerCase().includes(query));
    });
  }

  /**
   * Marks exactly one filter button as active, both visually
   * (existing .filter-btn-active class + design language already
   * defined in style.css) and for assistive tech (aria-current).
   * @param {string} filterId
   */
  function updateFilterButtonStates(filterId) {
    filterButtons.forEach((btn) => {
      const isActive = btn.dataset.filter === filterId;
      btn.classList.toggle('filter-btn-active', isActive);
      if (isActive) {
        btn.setAttribute('aria-current', 'true');
      } else {
        btn.removeAttribute('aria-current');
      }
    });
  }

  // Shared formatter for the Custom subtitle's date labels, e.g.
  // "10 Jul 2026" — created once and reused, same pattern as the
  // other formatters in section 4.
  const filterDateLabelFormatter = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  /**
   * The single place responsible for the small subtitle shown
   * under the filter chips. Only Today, This Week, and Custom get
   * a description — All, Month, and Year intentionally return an
   * empty string (PHASE 7.6 leaves Month/Year "as is" and All
   * "clean", per spec). No filter-description strings live
   * anywhere else in the file.
   * @param {Array} filteredExpenses
   * @returns {string} empty string means "no subtitle".
   */
  function generateFilterDescription(filteredExpenses) {
    switch (currentFilter) {
      case 'today':
        return filteredExpenses.length > 0
          ? "Showing today's expenses"
          : 'No expenses recorded today';

      case 'week':
        return "Showing this week's expenses";

      case 'custom': {
        if (!customDateRange.from || !customDateRange.to) return '';

        const fromLabel = filterDateLabelFormatter.format(customDateRange.from);
        const toLabel = filterDateLabelFormatter.format(customDateRange.to);
        let description = `Showing expenses from ${fromLabel} to ${toLabel}`;

        if (filteredExpenses.length > 0) {
          const count = filteredExpenses.length;
          description += ` • ${count} expense${count === 1 ? '' : 's'}`;
        }

        return description;
      }

      // 'all', 'month', 'year' — intentionally no subtitle.
      default:
        return '';
    }
  }

  /**
   * Renders whatever generateFilterDescription() produced. Hides
   * the element entirely when there's nothing to show, rather than
   * leaving an empty line under the filter chips.
   * @param {string} description
   */
  function renderFilterDescription(description) {
    filterDescriptionEl.textContent = description;
    filterDescriptionEl.hidden = description === '';
  }

  /**
   * Single entry point for refreshing everything that depends on
   * the currently displayed expense list. Computes the filtered
   * list exactly once, then hands that same array to
   * renderExpenses(), updateDashboard(), and
   * generateFilterDescription() — so filtering never needs to be
   * recalculated per UI piece, and every mutation (add, edit,
   * delete, budget change, filter change) can end with one call
   * instead of duplicating this sequence.
   */
  function refreshUI() {
    const dateFilteredExpenses = applyCurrentFilter(expenses);
    const filteredExpenses = applySearchFilter(dateFilteredExpenses);
    renderExpenses(filteredExpenses, dateFilteredExpenses.length > 0);
    updateDashboard(expenses);
    // The filter subtitle describes the active date filter itself
    // (e.g. "Showing this week's expenses"), so it's generated from
    // dateFilteredExpenses — search narrowing the visible list
    // further doesn't change what date range is active.
    renderFilterDescription(generateFilterDescription(dateFilteredExpenses));
    updateExportButtonState();
  }

  /**
   * Changes the active filter and refreshes the UI to match. The
   * budget itself is never filtered — only which expenses are
   * considered when the dashboard recalculates.
   * @param {string} filterId
   */
  function setFilter(filterId) {
    currentFilter = filterId;
    updateFilterButtonStates(filterId);
    refreshUI();
  }

  /**
   * Converts a "YYYY-MM-DD" <input type="date"> value into a local
   * Date at 00:00:00.000. Built manually from the numeric parts
   * (rather than `new Date(dateString)`) because date-only ISO
   * strings are parsed as UTC midnight by the Date constructor,
   * which would silently shift the boundary by a day in any
   * timezone other than UTC.
   * @param {string} dateStr
   * @returns {Date}
   */
  function parseDateInputToLocalStart(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
  }

  /**
   * Same as parseDateInputToLocalStart(), but returns the last
   * instant of that local day (23:59:59.999), so the "To" date is
   * inclusive of every expense created on it.
   * @param {string} dateStr
   * @returns {Date}
   */
  function parseDateInputToLocalEnd(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    date.setHours(23, 59, 59, 999);
    return date;
  }

  /**
   * Formats a Date back into "YYYY-MM-DD" for pre-filling an
   * <input type="date">, using local calendar components (not
   * toISOString(), which is UTC and can shift the day).
   * @param {Date} date
   * @returns {string}
   */
  function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Hides the Custom Range validation message.
   */
  function clearCustomRangeError() {
    customRangeErrorEl.hidden = true;
    customRangeErrorEl.textContent = '';
  }

  /**
   * Shows a user-friendly validation message in the Custom Range
   * sheet without closing it or touching `currentFilter`.
   * @param {string} message
   */
  function showCustomRangeError(message) {
    customRangeErrorEl.textContent = message;
    customRangeErrorEl.hidden = false;
  }

  /**
   * Opens the Custom Range sheet. Pre-fills the From/To fields with
   * the currently applied custom range, if any, so reopening it to
   * tweak a range doesn't lose the previous selection.
   */
  function openCustomRangeSheet() {
    clearCustomRangeError();

    // Cap both pickers at today's local date so the calendar UI
    // itself can't offer tomorrow or later. Set on open (rather than
    // once at init) so the cap stays correct even if the app is left
    // open across midnight.
    const todayValue = formatDateForInput(new Date());
    customRangeFromInput.max = todayValue;
    customRangeToInput.max = todayValue;

    customRangeFromInput.value = customDateRange.from ? formatDateForInput(customDateRange.from) : '';
    customRangeToInput.value = customDateRange.to ? formatDateForInput(customDateRange.to) : '';

    customRangeSheetOverlay.hidden = false;
    customRangeSheetOverlay.classList.remove('sheet-hidden');
    customRangeFromInput.focus();
  }

  /**
   * Closes the Custom Range sheet without changing any state.
   * Used by both the Cancel button and a successful Apply.
   */
  function closeCustomRangeSheet() {
    customRangeSheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      customRangeSheetOverlay.hidden = true;
    }, 220);
  }

  customRangeCancelBtn.addEventListener('click', closeCustomRangeSheet);

  customRangeForm.addEventListener('submit', (event) => {
    event.preventDefault();
    clearCustomRangeError();

    const fromValue = customRangeFromInput.value;
    const toValue = customRangeToInput.value;

    // ---- Validation ----
    if (!fromValue) {
      showCustomRangeError('Please select a start date.');
      return;
    }

    if (!toValue) {
      showCustomRangeError('Please select an end date.');
      return;
    }

    // Safety net behind the date pickers' max attribute — catches a
    // future date however it got into the field (manual edit,
    // browser quirk), rather than trusting the picker alone.
    const todayValue = formatDateForInput(new Date());
    if (fromValue > todayValue || toValue > todayValue) {
      showCustomRangeError('Dates cannot be in the future.');
      return;
    }

    const from = parseDateInputToLocalStart(fromValue);
    const to = parseDateInputToLocalEnd(toValue);

    if (from > to) {
      showCustomRangeError('"From" date must be before or the same as "To" date.');
      return;
    }

    // ---- Commit: update memory, then refresh ----
    customDateRange = { from, to };
    setFilter('custom');
    closeCustomRangeSheet();
  });

  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      // Selecting Custom never filters immediately — it opens the
      // picker, and only Apply (above) commits to currentFilter.
      if (btn.dataset.filter === 'custom') {
        openCustomRangeSheet();
        return;
      }
      setFilter(btn.dataset.filter);
    });
  });

  /**
   * Shows the clear (×) button only while there's search text to
   * clear — mirrors the hidden-attribute pattern used everywhere
   * else in the file (e.g. #expense-history-empty).
   */
  function updateSearchClearButtonState() {
    expenseSearchClearBtn.hidden = searchQuery.length === 0;
  }

  // No debounce (per spec — filtering the in-memory `expenses`
  // array is fast enough). Every keystroke just updates
  // `searchQuery` and re-runs the same refreshUI() every other
  // mutation already goes through, so search never needs its own
  // rendering path.
  expenseSearchInput.addEventListener('input', () => {
    searchQuery = expenseSearchInput.value;
    updateSearchClearButtonState();
    refreshUI();
  });

  expenseSearchClearBtn.addEventListener('click', () => {
    searchQuery = '';
    expenseSearchInput.value = '';
    updateSearchClearButtonState();
    expenseSearchInput.focus();
    refreshUI();
  });

  /**
   * Keeps the scroll-hint chevron in sync with the filter row's
   * scroll position. Purely cosmetic — never touches `currentFilter`
   * or any expense/budget state. Hides once the row is scrolled
   * (almost) all the way to the end, since at that point Custom is
   * already visible and the hint has nothing left to hint at.
   */
  function updateFiltersScrollHint() {
    if (!historyFiltersNav || !filtersScrollHint) return;

    const { scrollLeft, scrollWidth, clientWidth } = historyFiltersNav;
    const remainingScroll = scrollWidth - clientWidth - scrollLeft;
    const canScrollMore = remainingScroll > 8; // small buffer for rounding

    filtersScrollHint.classList.toggle('is-visible', canScrollMore);
    filtersScrollHint.classList.toggle('is-hidden', !canScrollMore);
  }

  if (historyFiltersNav && filtersScrollHint) {
    historyFiltersNav.addEventListener('scroll', updateFiltersScrollHint, { passive: true });
    window.addEventListener('resize', updateFiltersScrollHint);

    filtersScrollHint.addEventListener('click', () => {
      historyFiltersNav.scrollTo({
        left: historyFiltersNav.scrollWidth,
        behavior: 'smooth'
      });
    });

    // Run once after layout settles so the hint's initial visibility
    // reflects whether the row actually overflows.
    requestAnimationFrame(updateFiltersScrollHint);
  }


  /* ================================================================
     19. SETTINGS PANEL (PHASE 10)
     A right-side slide-over, distinct from the bottom sheets above
     — same show/hide + delayed-hidden pattern (see openBudgetSheet/
     closeBudgetSheet), just sliding horizontally instead of
     vertically. Purely a UI addition: it doesn't touch expenses,
     budget, filters, or storage beyond reading `expenses` for CSV
     export.
     ================================================================ */

  const SETTINGS_PANEL_TRANSITION_MS = 300;

  function openSettingsPanel() {
    settingsOverlay.hidden = false;
    // Force a reflow before removing the hidden class so the
    // slide-in transition actually runs instead of jumping straight
    // to its open state (same reason closeSettingsPanel below waits
    // before re-hiding).
    void settingsOverlay.offsetWidth;
    settingsOverlay.classList.remove('settings-hidden');
    closeSettingsBtn.focus();
  }

  function closeSettingsPanel() {
    settingsOverlay.classList.add('settings-hidden');
    window.setTimeout(() => {
      settingsOverlay.hidden = true;
    }, SETTINGS_PANEL_TRANSITION_MS);
  }

  openSettingsBtn.addEventListener('click', openSettingsPanel);
  closeSettingsBtn.addEventListener('click', closeSettingsPanel);

  // Tapping the dimmed area outside the panel closes it. A click
  // lands on settingsOverlay itself only when it didn't land on the
  // panel (or anything inside it), since the panel doesn't fill the
  // overlay.
  settingsOverlay.addEventListener('click', (event) => {
    if (event.target === settingsOverlay) {
      closeSettingsPanel();
    }
  });

  // Escape closes the panel, but only while it's actually open —
  // this listener is always attached, so it has to check state
  // itself rather than being added/removed on open/close.
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !settingsOverlay.hidden) {
      closeSettingsPanel();
    }
  });

  /**
   * Wires a toggle button to an accordion panel using a max-height
   * transition. The panel's real height is measured via
   * scrollHeight at the moment of toggling — nothing is hardcoded —
   * so this works unchanged regardless of how long the section's
   * content is.
   * @param {HTMLElement} toggleBtn
   * @param {HTMLElement} panel
   */
  function setupAccordion(toggleBtn, panel) {
    toggleBtn.addEventListener('click', () => {
      const isOpen = toggleBtn.getAttribute('aria-expanded') === 'true';

      if (isOpen) {
        panel.style.maxHeight = `${panel.scrollHeight}px`;
        // Read the height first, then collapse on the next frame —
        // collapsing in the same tick as setting the starting height
        // would skip straight to 0 with no transition to animate.
        requestAnimationFrame(() => {
          panel.style.maxHeight = '0px';
        });
        toggleBtn.setAttribute('aria-expanded', 'false');
      } else {
        toggleBtn.setAttribute('aria-expanded', 'true');
        panel.style.maxHeight = `${panel.scrollHeight}px`;
      }
    });
  }

  setupAccordion(exportDataToggle, exportDataPanel);
  setupAccordion(aboutPebbleToggle, aboutPebblePanel);

  /* ================================================================
     19.1 ANALYTICS NAVIGATION (PHASE 13 — v1.2 Analytics Foundation)
     Analytics is a separate page (analytics.html), not a screen
     inside index.html. To keep the Home -> Settings -> Analytics ->
     Back -> Settings -> Back -> Home flow feeling like continuous
     in-app navigation (rather than dropping the user back on a
     closed Home screen), a small flag is stashed in sessionStorage
     right before leaving for Analytics. On return, Home checks the
     flag and reopens the Settings panel automatically. The matching
     half of this flow — setting the flag again on Back and
     navigating home — lives in the page-routing branch at the very
     top of this file (PHASE 14), since that's the only Analytics-side
     logic this shared script.js needs to run on analytics.html.
     ================================================================ */

  const REOPEN_SETTINGS_FLAG = 'pebble-reopen-settings';

  if (openAnalyticsBtn) {
    openAnalyticsBtn.addEventListener('click', () => {
      sessionStorage.setItem(REOPEN_SETTINGS_FLAG, '1');
    });
  }

  if (sessionStorage.getItem(REOPEN_SETTINGS_FLAG) === '1') {
    sessionStorage.removeItem(REOPEN_SETTINGS_FLAG);
    openSettingsPanel();
  }


  /* ================================================================
     19.2 MANAGE CATEGORIES (v1.5 Phase B)
     The first user-facing feature built on the Category Foundation
     (section 0.4). Three stacked bottom sheets, all following the
     exact same show/hide pattern as the Budget/Expense Detail sheets
     above: Manage Categories (list + Add Category entry point),
     Add Category (name + emoji form), and Delete Category
     (confirmation, worded differently depending on whether the
     category is currently in use).

     LIVE UPDATE: every mutation here (add or delete) ends with the
     same two calls — renderCategories() (rebuilds the Add Expense
     dropdown from getCategories()) and refreshUI() (rebuilds
     expense cards, dashboard, category summary, and chart from
     `expenses`, all of which already resolve category name/emoji/
     color live via the category manager, section 0.4). That's every
     place on index.html a category can appear, so nothing here
     needs its own bespoke re-render. CSV export reads
     getCategoryName() at export time, so it's automatically current
     too. Analytics lives on a separate page and reads categories
     fresh from LocalStorage on its own load — there is no moment
     where both pages are on screen at once for a "live" cross-page
     update to matter.
     ================================================================ */

  function openManageCategoriesSheet() {
    renderManageCategoriesList();
    manageCategoriesSheetOverlay.hidden = false;
    void manageCategoriesSheetOverlay.offsetWidth;
    manageCategoriesSheetOverlay.classList.remove('sheet-hidden');
  }

  function closeManageCategoriesSheet() {
    manageCategoriesSheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      manageCategoriesSheetOverlay.hidden = true;
    }, 280);
  }

  if (openManageCategoriesBtn) {
    openManageCategoriesBtn.addEventListener('click', openManageCategoriesSheet);
  }
  manageCategoriesCloseBtn.addEventListener('click', closeManageCategoriesSheet);
  manageCategoriesSheetOverlay.addEventListener('click', (event) => {
    if (event.target === manageCategoriesSheetOverlay) {
      closeManageCategoriesSheet();
    }
  });

  /**
   * Builds one row for the Manage Categories list: emoji, name, a
   * "Default" badge only when isDefault is true, and a delete
   * button. The protected "Others" category still gets a delete
   * button (never hidden) so the row shape stays consistent, but
   * tapping it explains why via a toast instead of opening the
   * confirmation sheet.
   * @param {{id:string,name:string,emoji:string,isDefault:boolean}} category
   * @returns {HTMLLIElement}
   */
  function createManageCategoryRow(category) {
    const row = document.createElement('li');
    row.className = 'manage-category-row';
    row.dataset.categoryId = category.id;

    const icon = document.createElement('span');
    icon.className = 'manage-category-icon';
    icon.textContent = category.emoji;
    icon.setAttribute('aria-hidden', 'true');

    const name = document.createElement('p');
    name.className = 'manage-category-name';
    name.textContent = category.name;

    row.append(icon, name);

    if (category.isDefault) {
      const badge = document.createElement('span');
      badge.className = 'manage-category-badge';
      badge.textContent = 'Default';
      row.appendChild(badge);
    }

    const isProtected = category.id === PROTECTED_CATEGORY_ID;

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'manage-category-delete-btn';
    if (isProtected) deleteBtn.classList.add('manage-category-delete-protected');
    deleteBtn.setAttribute('aria-label', `Delete ${category.name}`);
    deleteBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
      </svg>
    `;
    deleteBtn.addEventListener('click', () => handleDeleteCategoryTap(category.id));

    row.appendChild(deleteBtn);
    return row;
  }

  /**
   * Clears and rebuilds the Manage Categories list from the category
   * manager. Called every time the sheet opens, and again after any
   * add/delete so it never shows stale data while still on screen.
   */
  function renderManageCategoriesList() {
    manageCategoriesList.innerHTML = '';
    getCategories().forEach((category) => {
      manageCategoriesList.appendChild(createManageCategoryRow(category));
    });
  }

  /* ---------------- Add Category ---------------- */

  function openAddCategorySheet() {
    addCategoryForm.reset();
    addCategoryErrorEl.hidden = true;
    addCategoryEmojiPresets.querySelectorAll('.emoji-preset-btn').forEach((btn) => {
      btn.classList.remove('emoji-preset-selected');
    });
    addCategorySheetOverlay.hidden = false;
    void addCategorySheetOverlay.offsetWidth;
    addCategorySheetOverlay.classList.remove('sheet-hidden');
    addCategoryNameInput.focus();
  }

  function closeAddCategorySheet() {
    addCategorySheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      addCategorySheetOverlay.hidden = true;
    }, 220);
  }

  addCategoryBtn.addEventListener('click', openAddCategorySheet);
  addCategoryCancelBtn.addEventListener('click', closeAddCategorySheet);
  addCategorySheetOverlay.addEventListener('click', (event) => {
    if (event.target === addCategorySheetOverlay) {
      closeAddCategorySheet();
    }
  });

  // Tapping a preset fills (and visually selects) the emoji field —
  // the field itself stays a real text input, so a user can still
  // type any other emoji it doesn't cover.
  addCategoryEmojiPresets.querySelectorAll('.emoji-preset-btn').forEach((presetBtn) => {
    presetBtn.addEventListener('click', () => {
      addCategoryEmojiInput.value = presetBtn.dataset.emoji;
      addCategoryEmojiPresets.querySelectorAll('.emoji-preset-btn').forEach((btn) => {
        btn.classList.remove('emoji-preset-selected');
      });
      presetBtn.classList.add('emoji-preset-selected');
    });
  });

  /**
   * Shows a validation message inline in the Add Category sheet —
   * never alert()/prompt(), matching every other native-feeling
   * validation surface in this app (e.g. #custom-range-error).
   * @param {string} message
   */
  function showAddCategoryError(message) {
    addCategoryErrorEl.textContent = message;
    addCategoryErrorEl.hidden = false;
  }

  addCategoryForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const name = addCategoryNameInput.value.trim();
    const emoji = addCategoryEmojiInput.value.trim();

    if (!name) {
      showAddCategoryError('Please enter a category name.');
      return;
    }
    if (!emoji) {
      showAddCategoryError('Please choose or type an emoji.');
      return;
    }
    if (isDuplicateCategoryName(name)) {
      showAddCategoryError('A category with this name already exists.');
      return;
    }

    addCategory({ name, emoji });

    closeAddCategorySheet();
    renderManageCategoriesList();
    renderCategories();
    refreshUI();
    showToast('success', 'Category Added');
  });

  /* ---------------- Delete Category ---------------- */

  // The category id the Delete Category sheet is currently acting
  // on, set right before the sheet opens and read by its Confirm
  // button — same pattern as `activeDetailExpenseId` above.
  let pendingDeleteCategoryId = null;

  function openDeleteCategorySheet(categoryId, expenseCount) {
    pendingDeleteCategoryId = categoryId;
    const category = getCategoryById(categoryId);
    const categoryLabel = category ? category.name : 'this category';

    deleteCategoryMessageEl.textContent = expenseCount > 0
      ? `"${categoryLabel}" is used by ${expenseCount} expense${expenseCount === 1 ? '' : 's'}. Deleting it will move ${expenseCount === 1 ? 'that expense' : 'those expenses'} to "Others". This can't be undone.`
      : `Delete "${categoryLabel}"? This can't be undone.`;

    deleteCategorySheetOverlay.hidden = false;
    void deleteCategorySheetOverlay.offsetWidth;
    deleteCategorySheetOverlay.classList.remove('sheet-hidden');
  }

  function closeDeleteCategorySheet() {
    deleteCategorySheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      deleteCategorySheetOverlay.hidden = true;
    }, 220);
    pendingDeleteCategoryId = null;
  }

  deleteCategoryCancelBtn.addEventListener('click', closeDeleteCategorySheet);
  deleteCategorySheetOverlay.addEventListener('click', (event) => {
    if (event.target === deleteCategorySheetOverlay) {
      closeDeleteCategorySheet();
    }
  });

  /**
   * Handles a tap on a category row's delete button. The protected
   * "Others" category never opens the confirmation sheet — it
   * explains itself via a toast instead, since there is nothing a
   * confirmation could meaningfully ask ("delete, and migrate its
   * expenses to... itself"?).
   * @param {string} categoryId
   */
  function handleDeleteCategoryTap(categoryId) {
    if (categoryId === PROTECTED_CATEGORY_ID) {
      showToast('error', '"Others" is required and can\u2019t be deleted.');
      return;
    }
    openDeleteCategorySheet(categoryId, countExpensesUsingCategory(categoryId));
  }

  deleteCategoryConfirmBtn.addEventListener('click', () => {
    if (!pendingDeleteCategoryId) return;

    const result = deleteCategory(pendingDeleteCategoryId);
    closeDeleteCategorySheet();

    if (!result.success) {
      // Defensive only — handleDeleteCategoryTap() already filters
      // out the protected id before this sheet can even open, and a
      // 'not-found' category can't reach here either since the row
      // it came from is only ever built from a real category.
      showToast('error', 'Could not delete this category.');
      return;
    }

    renderManageCategoriesList();
    renderCategories();
    refreshUI();
    showToast('success', result.migratedCount > 0 ? 'Category Deleted \u00b7 Expenses Moved' : 'Category Deleted');
  });


  /* ================================================================
     19.3 BACKUP & RESTORE (v1.7)
     Fully offline — no backend, no accounts, no cloud storage. A
     backup is just a JSON snapshot of everything Pebble already
     persists to LocalStorage under its three existing keys
     (STORAGE_KEY, CATEGORIES_STORAGE_KEY, BUDGET_ALERTS_STORAGE_KEY
     — see sections 0, 0.4, and 21.5), downloaded as a file; a
     restore reverses that by writing a validated file's contents
     back into those same three keys and then calling the exact same
     loadState()/loadCategories()/loadBudgetAlertState() every normal
     launch already uses to hydrate memory. No parallel save/load
     logic is introduced anywhere in this section.

     Three stacked sheets, same shape as the Manage Categories flow
     above: Backup & Restore (the hub — two actions), Backup
     Confirmation, and Restore Confirmation. Neither Download nor
     Restore ever runs without its confirmation sheet being accepted
     first.

     VALIDATION follows the same "reject, don't repair" philosophy as
     isValidExpense()/isValidCategory()/isValidBudgetAlertState():
     a structurally wrong file (bad JSON, wrong app, missing
     expenses/categories, or a backupVersion newer than this build
     understands) is rejected outright and NOTHING is written to
     LocalStorage — the app's current data is never touched. Once a
     file passes that structural check, the same per-item filtering
     loadState()/loadCategories() already do on every launch quietly
     drops any individually malformed expense/category rather than
     failing the whole restore over one bad row.
     ================================================================ */

  // Independent of `appVersion` on purpose (see the metadata this
  // writes below) — this only needs to change if the *shape* of the
  // backed-up data itself changes, not on every app release. A
  // future Pebble could keep reading backupVersion 1 files by
  // branching on this number, even after its own appVersion has
  // moved far past "1.7".
  const BACKUP_FORMAT_VERSION = 1;
  const BACKUP_APP_NAME = 'Pebble';

  /**
   * "YYYY-MM-DD_HH-MM" in local time, for the backup filename.
   * Deliberately not reusing formatDateForInput() (date-only) since
   * the filename also needs hours/minutes to avoid collisions
   * between two backups taken the same day.
   * @param {Date} date
   * @returns {string}
   */
  function formatBackupFilenameTimestamp(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}_${hours}-${minutes}`;
  }

  /**
   * Builds the full backup object from live in-memory state —
   * `expenses`/`budget`/`lastPaymentMethod`/`categories`/
   * `budgetAlertState` — rather than re-reading LocalStorage,
   * since every mutation in this app already ends with a
   * saveState()/saveCategories()/saveBudgetAlertState() call, so
   * memory and storage are never out of sync at rest.
   * @returns {object}
   */
  function buildBackupPayload() {
    return {
      metadata: {
        app: BACKUP_APP_NAME,
        appVersion: '1.7',
        backupVersion: BACKUP_FORMAT_VERSION,
        backupCreated: new Date().toISOString()
      },
      data: {
        pebbleData: { budget, expenses, lastPaymentMethod },
        categories,
        budgetAlerts: budgetAlertState
      }
    };
  }

  /**
   * Triggers a browser download of a fresh backup via the same
   * throwaway link + Blob URL technique as downloadExpensesCsv()
   * (section 20 below) — just JSON instead of CSV.
   */
  function downloadBackupFile() {
    const payload = buildBackupPayload();
    const jsonContent = JSON.stringify(payload, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `Pebble_Backup_${formatBackupFilenameTimestamp(new Date())}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Structural validation for an uploaded backup file — "reject,
   * don't repair," same as every other LocalStorage-facing validator
   * in this app. Only `data.pebbleData` (budget + expenses) and
   * `data.categories` are treated as required sections; a missing or
   * malformed `data.budgetAlerts` doesn't fail the whole file (see
   * restoreFromBackupPayload()), since alert-threshold state is
   * reconstructible and losing it is not data loss the way losing
   * expenses or categories would be.
   * @param {*} parsed
   * @returns {boolean}
   */
  function isValidBackupPayload(parsed) {
    if (!parsed || typeof parsed !== 'object') return false;

    const metadata = parsed.metadata;
    if (!metadata || typeof metadata !== 'object' || metadata.app !== BACKUP_APP_NAME) return false;
    if (typeof metadata.backupVersion !== 'number') return false;
    // A backup written by a future, incompatible Pebble — reject
    // rather than guessing at a shape this build doesn't understand.
    if (metadata.backupVersion > BACKUP_FORMAT_VERSION) return false;

    const data = parsed.data;
    if (!data || typeof data !== 'object') return false;

    const pebbleData = data.pebbleData;
    const hasValidPebbleData =
      pebbleData && typeof pebbleData === 'object' &&
      Number.isFinite(pebbleData.budget) &&
      Array.isArray(pebbleData.expenses);
    if (!hasValidPebbleData) return false;

    if (!Array.isArray(data.categories)) return false;

    return true;
  }

  /**
   * Restores Pebble's entire state from an already-validated backup
   * payload. Writes the backup's sections straight into the same
   * three LocalStorage keys the app already owns, then calls
   * loadState()/loadCategories()/loadBudgetAlertState() — the exact
   * functions every normal launch uses to turn LocalStorage into
   * memory — so this never duplicates a single line of load logic.
   * Those functions already filter out individually malformed
   * expenses/categories via isValidExpense()/isValidCategory()
   * rather than repairing them, exactly as they do on every launch.
   * @param {object} payload — must have already passed isValidBackupPayload()
   * @returns {boolean} true if the write to LocalStorage succeeded
   */
  function restoreFromBackupPayload(payload) {
    const { pebbleData, categories: backupCategories, budgetAlerts } = payload.data;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        budget: pebbleData.budget,
        expenses: pebbleData.expenses,
        lastPaymentMethod: pebbleData.lastPaymentMethod
      }));
      localStorage.setItem(CATEGORIES_STORAGE_KEY, JSON.stringify(backupCategories));
    } catch (error) {
      console.error('Pebble: failed to write restored data to LocalStorage.', error);
      return false;
    }

    // The one non-essential section (see isValidBackupPayload()) —
    // reset to a clean slate first so an invalid/missing section in
    // the backup can never leave *this session's* pre-restore alert
    // state lying around afterward.
    budgetAlertState = { month: null, triggeredThresholds: [] };
    try {
      if (isValidBudgetAlertState(budgetAlerts)) {
        localStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(budgetAlerts));
      } else {
        localStorage.removeItem(BUDGET_ALERTS_STORAGE_KEY);
      }
    } catch (error) {
      console.error('Pebble: failed to write restored budget alert state.', error);
    }

    // Reload every in-memory piece from what was just written.
    loadState();
    loadCategories();
    loadBudgetAlertState();

    // Everything on screen reflects the restored data immediately —
    // no manual refresh, no page reload.
    renderCategories();
    refreshUI();

    return true;
  }

  /* ---------------- Backup & Restore hub sheet ---------------- */

  // Remembers what had focus before the hub sheet opened, so closing
  // it (via Cancel, the X, Escape, or tap-outside) returns focus
  // there instead of leaving it stranded on a hidden element.
  let backupRestoreTriggerEl = null;

  function openBackupRestoreSheet() {
    backupRestoreTriggerEl = document.activeElement;
    backupRestoreSheetOverlay.hidden = false;
    void backupRestoreSheetOverlay.offsetWidth;
    backupRestoreSheetOverlay.classList.remove('sheet-hidden');
    backupRestoreCloseBtn.focus();
  }

  function closeBackupRestoreSheet() {
    backupRestoreSheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      backupRestoreSheetOverlay.hidden = true;
    }, 280);
    if (backupRestoreTriggerEl instanceof HTMLElement) backupRestoreTriggerEl.focus();
  }

  if (openBackupRestoreBtn) {
    openBackupRestoreBtn.addEventListener('click', openBackupRestoreSheet);
  }
  backupRestoreCloseBtn.addEventListener('click', closeBackupRestoreSheet);
  backupRestoreSheetOverlay.addEventListener('click', (event) => {
    if (event.target === backupRestoreSheetOverlay) {
      closeBackupRestoreSheet();
    }
  });

  /* ---------------- Backup confirmation ---------------- */

  let backupConfirmTriggerEl = null;

  function openBackupConfirmSheet() {
    backupConfirmTriggerEl = document.activeElement;
    backupConfirmSheetOverlay.hidden = false;
    void backupConfirmSheetOverlay.offsetWidth;
    backupConfirmSheetOverlay.classList.remove('sheet-hidden');
  }

  function closeBackupConfirmSheet() {
    backupConfirmSheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      backupConfirmSheetOverlay.hidden = true;
    }, 220);
    if (backupConfirmTriggerEl instanceof HTMLElement) backupConfirmTriggerEl.focus();
  }

  downloadBackupBtn.addEventListener('click', openBackupConfirmSheet);
  backupConfirmCancelBtn.addEventListener('click', closeBackupConfirmSheet);
  backupConfirmSheetOverlay.addEventListener('click', (event) => {
    if (event.target === backupConfirmSheetOverlay) {
      closeBackupConfirmSheet();
    }
  });

  backupConfirmDownloadBtn.addEventListener('click', () => {
    downloadBackupFile();
    closeBackupConfirmSheet();
    closeBackupRestoreSheet();
    showToast('success', 'Backup downloaded successfully');
  });

  /* ---------------- Restore confirmation + file picker ---------------- */

  let restoreConfirmTriggerEl = null;

  function openRestoreConfirmSheet() {
    restoreConfirmTriggerEl = document.activeElement;
    restoreConfirmSheetOverlay.hidden = false;
    void restoreConfirmSheetOverlay.offsetWidth;
    restoreConfirmSheetOverlay.classList.remove('sheet-hidden');
  }

  function closeRestoreConfirmSheet() {
    restoreConfirmSheetOverlay.classList.add('sheet-hidden');
    window.setTimeout(() => {
      restoreConfirmSheetOverlay.hidden = true;
    }, 220);
    if (restoreConfirmTriggerEl instanceof HTMLElement) restoreConfirmTriggerEl.focus();
  }

  restoreBackupBtn.addEventListener('click', openRestoreConfirmSheet);
  restoreConfirmCancelBtn.addEventListener('click', closeRestoreConfirmSheet);
  restoreConfirmSheetOverlay.addEventListener('click', (event) => {
    if (event.target === restoreConfirmSheetOverlay) {
      closeRestoreConfirmSheet();
    }
  });

  // Confirming just closes this sheet and opens the OS file picker —
  // the hub sheet stays open behind it so a failed/cancelled pick
  // lands the user right back where they can try again.
  restoreConfirmChooseFileBtn.addEventListener('click', () => {
    closeRestoreConfirmSheet();
    restoreFileInput.click();
  });

  restoreFileInput.addEventListener('change', () => {
    const file = restoreFileInput.files && restoreFileInput.files[0];
    // Always clear the input's value, success or failure, so
    // selecting the exact same file again still fires this event.
    restoreFileInput.value = '';
    if (!file) return;

    const reader = new FileReader();

    reader.onload = () => {
      let parsed;
      try {
        parsed = JSON.parse(String(reader.result));
      } catch (error) {
        showToast('error', 'This file isn\u2019t a valid Pebble backup.');
        return;
      }

      if (!isValidBackupPayload(parsed)) {
        showToast('error', 'This file isn\u2019t a valid Pebble backup.');
        return;
      }

      const restored = restoreFromBackupPayload(parsed);
      if (!restored) {
        showToast('error', 'Could not restore this backup.');
        return;
      }

      closeBackupRestoreSheet();
      showToast('success', 'Backup restored successfully');
    };

    reader.onerror = () => {
      showToast('error', 'Could not read this file.');
    };

    reader.readAsText(file);
  });

  // Escape closes whichever of the three sheets above is currently
  // open, most-nested first — same "only while actually open" guard
  // as the Expense Detail sheet's own Escape handler.
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!restoreConfirmSheetOverlay.hidden) {
      closeRestoreConfirmSheet();
    } else if (!backupConfirmSheetOverlay.hidden) {
      closeBackupConfirmSheet();
    } else if (!backupRestoreSheetOverlay.hidden) {
      closeBackupRestoreSheet();
    }
  });


  /* ================================================================
     20. CSV EXPORT (PHASE 10 + PHASE 11)
     Exports the full `expenses` array (not the currently filtered
     view — Export Data is about the whole history) as a CSV file,
     entirely client-side via a Blob URL.
     ================================================================ */

  /**
   * Escapes one CSV field per RFC 4180: wraps it in double quotes
   * and doubles any quote characters inside it. Every field is
   * quoted unconditionally rather than only the ones that need it —
   * simplest way to stay correct for notes that happen to contain
   * commas, quotes, or line breaks.
   * @param {string|number} field
   * @returns {string}
   */
  function escapeCsvField(field) {
    return `"${String(field).replace(/"/g, '""')}"`;
  }

  /**
   * Builds the CSV string for every expense currently in state.
   * Reuses the category manager for the category name shown in the
   * UI, rather than exporting the raw category id, and reuses
   * formatDateForInput for a plain, spreadsheet-friendly date.
   *
   * PHASE 11: a new "Payment Method" column is appended, exporting
   * "Cash"/"Digital" (via PAYMENT_METHOD_MAP, same pattern as
   * category names) for every expense that has one. Older expenses
   * saved before this phase have no `paymentMethod` — those export
   * as an empty field rather than guessing, since CSV export is a
   * record of what was actually stored, not a place to silently
   * inject an assumed value.
   * @returns {string}
   */
  function buildExpensesCsv() {
    const header = ['Date', 'Amount', 'Category', 'Note', 'Payment Method'];
    const rows = expenses.map((expense) => {
      const date = formatDateForInput(new Date(expense.createdAt));
      const category = getCategoryById(expense.category)?.name || expense.category;
      const note = expense.note || '';
      const paymentMethod = PAYMENT_METHOD_MAP.get(expense.paymentMethod)?.name || '';
      return [date, expense.amount.toFixed(2), category, note, paymentMethod];
    });

    return [header, ...rows]
      .map((row) => row.map(escapeCsvField).join(','))
      .join('\r\n');
  }

  /**
   * Triggers a browser download of the CSV built above via a
   * throwaway link + Blob URL. Nothing is added to the DOM
   * permanently, and the object URL is revoked right after the
   * click fires.
   */
  function downloadExpensesCsv() {
    const csvContent = buildExpensesCsv();
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `pebble-expenses-${formatDateForInput(new Date())}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  /**
   * Keeps the Export CSV button (and its "nothing to export" message)
   * in sync with whether any expenses exist. Called from refreshUI()
   * so it stays correct after every add/edit/delete, not just when
   * the Settings panel happens to be open.
   */
  function updateExportButtonState() {
    const hasExpenses = expenses.length > 0;
    exportCsvBtn.disabled = !hasExpenses;
    exportEmptyMessageEl.hidden = hasExpenses;
  }

  exportCsvBtn.addEventListener('click', () => {
    if (expenses.length === 0) return;
    downloadExpensesCsv();
  });


  /* ================================================================
     21. SUCCESS TOAST
     A single generic, reusable component — showToast(icon, message) —
     for any brief centered confirmation (Expense Saved, Expense
     Updated, and future ones like Expense Deleted / CSV Exported).
     It never decides *when* to fire; callers do that, then hand it
     just an icon key and a message. Nothing here touches `expenses`,
     `budget`, storage, or any other screen.
     ================================================================ */

  // Markup for each supported icon, keyed by name. Adding a future
  // icon (e.g. a red "x" for a delete/error toast) only means adding
  // one more entry here — showToast() itself never changes.
  const TOAST_ICONS = {
    success: `
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 12.5 10 17.5 19 7"/>
      </svg>
    `,
    // v1.5 Phase B — Manage Categories' "this category is protected"
    // toast is the first caller that needs a non-success icon.
    error: `
      <svg viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
      </svg>
    `
  };

  // Tracks pending timers across calls so a toast fired while
  // another is still visible/fading restarts cleanly instead of the
  // two overlapping or fighting over the same element.
  let toastShowTimeoutId = null;
  let toastHideTimeoutId = null;

  const TOAST_VISIBLE_MS = 900;
  const TOAST_FADE_MS = 180;

  // Budget Alert Timing
  const BUDGET_ALERT_VISIBLE_MS = 4000;
  const BUDGET_ALERT_FADE_MS = 300;

  /**
   * Shows a centered, auto-dismissing toast. Generic by design: any
   * feature that just needs a brief "X happened" confirmation calls
   * this instead of building its own animation/timer logic.
   * @param {keyof TOAST_ICONS} icon
   * @param {string} message
   */
  function showToast(icon, message, visibleMs = TOAST_VISIBLE_MS, fadeMs = TOAST_FADE_MS) {
    if (!toastEl) return;

    // Cancel any in-flight show/hide from a previous call so toasts
    // fired in quick succession don't collide.
    if (toastShowTimeoutId) window.clearTimeout(toastShowTimeoutId);
    if (toastHideTimeoutId) window.clearTimeout(toastHideTimeoutId);

    toastIconEl.innerHTML = TOAST_ICONS[icon] || TOAST_ICONS.success;
    toastIconEl.style.backgroundColor = icon === 'error' ? 'var(--color-danger)' : '';
    toastMessageEl.textContent = message;

    toastEl.hidden = false;
    toastEl.classList.remove('toast-visible', 'toast-hiding');

    // Force a reflow before adding the visible state so the opacity/
    // transform transition actually animates in, rather than jumping
    // straight to its end state (same technique used for the
    // Settings panel's slide-in elsewhere in this file).
    void toastEl.offsetWidth;
    toastEl.classList.add('toast-visible');

    toastShowTimeoutId = window.setTimeout(() => {
      toastEl.classList.remove('toast-visible');
      toastEl.classList.add('toast-hiding');

      toastHideTimeoutId = window.setTimeout(() => {
        toastEl.hidden = true;
        toastEl.classList.remove('toast-hiding');
      }, fadeMs);
    }, visibleMs);
  }

  /* ================================================================
     21.5 BUDGET ALERTS (v1.6 Phase A — Intelligent Budget Alerts)
     One reusable entry point — evaluateBudgetAlerts() — that every
     expense mutation (add, edit, delete) calls after saveState().
     Nothing else in the file touches budget-alert state; the checks
     are intentionally NOT scattered into updateDashboard(),
     refreshUI(), or the budget sheet itself, so "when spending
     changes" stays exactly Add/Edit/Delete Expense as specified.

     State is "which thresholds have already fired this month," not
     "which months have been alerted" — thresholds are independently
     re-armed the moment spending drops back below them (see the
     reset step in evaluateBudgetAlerts()), and the whole state
     starts over the moment the tracked month no longer matches the
     real calendar month. Persisted separately from `pebble-data`,
     the same pattern categories use for their own storage key.

     Toasts reuse showToast() (section 21) as-is — no new icon type,
     no new component. 50% maps to the existing green 'success'
     circle, 75/90/100 to the existing red 'error' circle, and a
     small queue (below) makes sure several thresholds crossed in a
     single mutation still show one at a time instead of clobbering
     each other via showToast()'s own single-toast timers.
     ================================================================ */

  const BUDGET_ALERTS_STORAGE_KEY = 'pebble-budget-alerts';

  // Ascending — evaluateBudgetAlerts() relies on this order so that
  // when several thresholds are crossed in one jump (e.g. a single
  // edit takes spending from 40% to 95%), they queue lowest-first.
  const BUDGET_ALERT_THRESHOLDS = [50, 75, 90, 100];

  // Reuses showToast()'s two existing icon keys by severity — no
  // third icon is introduced for this feature.
  const BUDGET_ALERT_ICONS = { 50: 'success', 75: 'error', 90: 'error', 100: 'error' };

  // In-memory alert state for the month currently being tracked.
  // `month` is a "YYYY-M" key (see getBudgetAlertMonthKey()) and
  // `triggeredThresholds` is the subset of BUDGET_ALERT_THRESHOLDS
  // already shown for that month. Loaded from LocalStorage once
  // below (loadBudgetAlertState()); every other read/write goes
  // through evaluateBudgetAlerts().
  let budgetAlertState = {
    month: null,
    triggeredThresholds: []
  };

  /**
   * "YYYY-M" key for a date's calendar month — the one definition
   * of "current month" for alert-state purposes, deliberately the
   * same definition getCurrentMonthExpenses() uses for spending, so
   * the two can never disagree about which month is "now."
   * @param {Date} date
   * @returns {string}
   */
  function getBudgetAlertMonthKey(date) {
    return `${date.getFullYear()}-${date.getMonth()}`;
  }

  /**
   * Schema check for state loaded from LocalStorage — same
   * "reject, don't repair" philosophy as isValidExpense()/
   * isValidCategory(). Anything malformed is discarded in favor of
   * the safe in-memory default (an empty, unstarted month), never
   * patched into something that merely looks valid.
   * @param {*} state
   * @returns {boolean}
   */
  function isValidBudgetAlertState(state) {
    return Boolean(
      state &&
      typeof state === 'object' &&
      typeof state.month === 'string' &&
      Array.isArray(state.triggeredThresholds) &&
      state.triggeredThresholds.every((threshold) => BUDGET_ALERT_THRESHOLDS.includes(threshold))
    );
  }

  function loadBudgetAlertState() {
    let raw;
    try {
      raw = localStorage.getItem(BUDGET_ALERTS_STORAGE_KEY);
    } catch (error) {
      console.error('Pebble: LocalStorage is unavailable for budget alerts.', error);
      return;
    }

    if (!raw) return; // Nothing saved yet — keep the empty default.

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.error('Pebble: saved budget alert state is corrupted, resetting.', error);
      try {
        localStorage.removeItem(BUDGET_ALERTS_STORAGE_KEY);
      } catch (removeError) {
        console.error('Pebble: failed to clear saved budget alert state.', removeError);
      }
      return;
    }

    if (isValidBudgetAlertState(parsed)) {
      budgetAlertState = parsed;
    }
  }

  function saveBudgetAlertState() {
    try {
      localStorage.setItem(BUDGET_ALERTS_STORAGE_KEY, JSON.stringify(budgetAlertState));
    } catch (error) {
      console.error('Pebble: failed to save budget alert state.', error);
    }
  }

  /**
   * This month's total spend and budget-usage percentage. Reuses
   * getCurrentMonthExpenses() (section 12) so "current month" is
   * defined in exactly one place across the whole app. Deliberately
   * NOT clamped to 100 — unlike calculateDashboardData()'s
   * display-only spendingPercentage — because the 100% alert needs
   * to know precisely how far over budget spending has gone.
   * @returns {{ totalSpent: number, percentage: number }}
   */
  function calculateBudgetAlertProgress() {
    const monthExpenses = getCurrentMonthExpenses(expenses);
    const totalSpent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const percentage = budget > 0 ? (totalSpent / budget) * 100 : 0;
    return { totalSpent, percentage };
  }

  /**
   * The exact copy for one threshold's toast, using live
   * totalSpent/budget figures. The 100% case is the only one with a
   * dynamic second line (how much over budget, not just the split).
   * @param {number} threshold
   * @param {number} totalSpent
   * @returns {string}
   */
  function buildBudgetAlertMessage(threshold, totalSpent) {
    const spentStr = currencyFormatter.format(totalSpent);
    const budgetStr = currencyFormatter.format(budget);

    switch (threshold) {
      case 50:
        return `💰 Half of your monthly budget has been used.\n${spentStr} of ${budgetStr} spent.`;
      case 75:
        return `⚠️ 75% of your monthly budget has been used.\n${spentStr} of ${budgetStr} spent.`;
      case 90:
        return `🚨 Only 10% of your monthly budget remains.\n${spentStr} of ${budgetStr} spent.`;
      case 100: {
        const exceededStr = currencyFormatter.format(Math.max(totalSpent - budget, 0));
        return `🚨 Budget exceeded.\nYou have exceeded your monthly budget by ${exceededStr}.`;
      }
      default:
        return '';
    }
  }

  // Small FIFO so several thresholds crossed in one mutation still
  // show one at a time — showToast() itself only ever knows about
  // "the current toast," so stacking calls to it back-to-back would
  // just cancel everything but the last one.
  let budgetAlertQueue = [];
  let budgetAlertQueueTimerId = null;

  function runNextBudgetAlertToast() {
    const next = budgetAlertQueue.shift();
    if (!next) {
      budgetAlertQueueTimerId = null;
      return;
    }
    showToast(next.icon, next.message, BUDGET_ALERT_VISIBLE_MS, BUDGET_ALERT_FADE_MS);
    budgetAlertQueueTimerId = window.setTimeout(() => {
      runNextBudgetAlertToast();
    }, BUDGET_ALERT_VISIBLE_MS + BUDGET_ALERT_FADE_MS);
  }

  /**
   * Queues one or more budget-alert toasts. `delayFirst` lets the
   * Add/Edit call site wait until the existing "Expense Saved" /
   * "Expense Updated" toast has fully finished before the first
   * budget toast appears, instead of the two fighting over the same
   * showToast() timers; the Delete call site (no competing toast)
   * doesn't need it.
   * @param {Array<{icon:string, message:string}>} toasts
   * @param {boolean} delayFirst
   */
  function queueBudgetAlertToasts(toasts, delayFirst) {
    if (toasts.length === 0) return;
    budgetAlertQueue.push(...toasts);

    if (budgetAlertQueueTimerId !== null) return; // already draining

    if (delayFirst) {
      budgetAlertQueueTimerId = window.setTimeout(() => {
        runNextBudgetAlertToast();
      }, TOAST_VISIBLE_MS + TOAST_FADE_MS);
    } else {
      runNextBudgetAlertToast();
    }
  }

  /**
   * THE single entry point for budget alerts. Called after
   * saveState() from every expense mutation — Add, Edit, Delete —
   * and nowhere else.
   *
   * Algorithm per the v1.6 spec:
   *  1. If the tracked month isn't the real current month anymore,
   *     start completely fresh (new month = clean slate).
   *  2. Recompute this month's spend percentage from scratch — never
   *     incremented, same philosophy as calculateDashboardData().
   *  3. Re-arm (un-trigger) any threshold currently ABOVE that
   *     percentage, so deleting/editing expenses back down makes it
   *     eligible to fire again later. Thresholds at or below the
   *     percentage stay completed.
   *  4. Whatever is now at-or-under the percentage but not yet
   *     triggered is newly crossed — mark it triggered, persist, and
   *     queue its toast (ascending, so 50 always shows before 75/90/
   *     100 when several are crossed in the same mutation).
   * @param {{ delayFirstToast?: boolean }} [options]
   */
  function evaluateBudgetAlerts(options = {}) {
    const monthKey = getBudgetAlertMonthKey(new Date());

    if (budgetAlertState.month !== monthKey) {
      budgetAlertState = { month: monthKey, triggeredThresholds: [] };
    }

    const { totalSpent, percentage } = calculateBudgetAlertProgress();

    // Step 3 — reset thresholds spending no longer supports.
    budgetAlertState.triggeredThresholds = budgetAlertState.triggeredThresholds
      .filter((threshold) => percentage >= threshold);

    // Step 4 — whatever's freshly met and not already completed.
    const newlyCrossed = BUDGET_ALERT_THRESHOLDS.filter((threshold) =>
      percentage >= threshold && !budgetAlertState.triggeredThresholds.includes(threshold)
    );

    if (newlyCrossed.length === 0) {
      saveBudgetAlertState();
      return;
    }

    newlyCrossed.forEach((threshold) => budgetAlertState.triggeredThresholds.push(threshold));
    saveBudgetAlertState();

    const toasts = newlyCrossed.map((threshold) => ({
      icon: BUDGET_ALERT_ICONS[threshold],
      message: buildBudgetAlertMessage(threshold, totalSpent)
    }));
    queueBudgetAlertToasts(toasts, options.delayFirstToast === true);
  }

  loadBudgetAlertState();


  /* ================================================================
     22. INITIALIZATION
     ================================================================ */

  // loadState() already ran once in section 0 (SHARED DATA LAYER),
  // before the PAGE ROUTING check — no need to call it again here.
  renderCategories();
  applyPaymentMethodSelection(lastPaymentMethod);
  updateFilterButtonStates(currentFilter);
  attachExpenseSheetEvents();
  refreshUI();

});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(() => console.log("Service Worker Registered"))
      .catch(console.error);
  });
}

/* ================================================================
   THIRD-PARTY ANALYTICS (Task 9 — Google Analytics 4 + Microsoft
   Clarity)

   Deliberately isolated in its own IIFE at the bottom of the file,
   outside the DOMContentLoaded handler above: this block never
   reads or writes any Pebble state (`expenses`, `budget`,
   `analyticsSelectedMonth`, etc.) and nothing in the rest of the app
   depends on it running. Pebble is an offline-first PWA, so both
   scripts are loaded dynamically at runtime rather than as static
   <script src="..."> tags in <head> — a static tag would attempt a
   network request (and log a failed-request error in DevTools) on
   every single offline page load, which is exactly what an
   offline-first app must not do.

   >>> IDS TO INSERT BEFORE GOING LIVE <<<
   - GA4_MEASUREMENT_ID below: replace 'YOUR_GA4_MEASUREMENT_ID' with
     the real GA4 Measurement ID (format: G-XXXXXXXXXX) from the GA4
     Admin > Data Streams panel.
   - CLARITY_PROJECT_ID below: replace 'YOUR_CLARITY_PROJECT_ID' with
     the real Project ID from the Microsoft Clarity dashboard's
     Setup/Overview page.
   Until real IDs are inserted, both loaders below intentionally
   no-op — the placeholder strings are checked for and skipped, so
   nothing is ever sent anywhere by accident.
   ================================================================ */
(function () {
  const GA4_MEASUREMENT_ID = 'G-CKB5GDN5TV';
  const CLARITY_PROJECT_ID = 'xobt4mmwbs';

  // Guarantees analytics initialization runs at most once per page
  // load, even if both the initial online check and a later 'online'
  // event could otherwise both attempt to fire it.
  let analyticsInitialized = false;

  /**
   * Official GA4 (gtag.js) snippet, adapted to run from a function
   * instead of firing unconditionally from inline <script> tags.
   * Wrapped in try/catch, with an error-swallowing onerror on the
   * injected <script> itself, so a blocked or failed request (ad
   * blocker, flaky connection, GitHub Pages/CDN hiccup, etc.) never
   * throws and never surfaces as a console error from Pebble's own
   * code — it simply means analytics silently stays off for that
   * session, exactly like the rest of the app expects.
   */
  function loadGoogleAnalytics() {
    try {
      if (!GA4_MEASUREMENT_ID || GA4_MEASUREMENT_ID === 'YOUR_GA4_MEASUREMENT_ID') return;

      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', GA4_MEASUREMENT_ID);

      const gaScript = document.createElement('script');
      gaScript.async = true;
      gaScript.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_MEASUREMENT_ID}`;
      gaScript.onerror = () => {}; // fails silently, never breaks or logs from Pebble's side
      document.head.appendChild(gaScript);
    } catch (error) {
      // Analytics must never be able to break the app itself.
    }
  }

  /**
   * Official Microsoft Clarity snippet, same shape as Microsoft's
   * own inline snippet (an IIFE that queues calls on `window.clarity`
   * until clarity.js finishes loading, then flushes them) — just
   * invoked conditionally here instead of unconditionally on every
   * page load, and with the same silent-failure handling as
   * loadGoogleAnalytics() above.
   */
  function loadMicrosoftClarity() {
    try {
      if (!CLARITY_PROJECT_ID || CLARITY_PROJECT_ID === 'YOUR_CLARITY_PROJECT_ID') return;

      (function (c, l, a, r, i, t, y) {
        c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r);
        t.async = 1;
        t.src = 'https://www.clarity.ms/tag/' + i;
        t.onerror = function () {}; // fails silently, same as loadGoogleAnalytics() above
        y = l.getElementsByTagName(r)[0];
        y.parentNode.insertBefore(t, y);
      })(window, document, 'clarity', 'script', CLARITY_PROJECT_ID);
    } catch (error) {
      // Analytics must never be able to break the app itself.
    }
  }

  /**
   * The single entry point for both integrations. Runs at most once
   * (analyticsInitialized guard) and only when the device is
   * currently online — offline-first is Pebble's whole premise, so
   * this is never allowed to attempt a network request while
   * offline, and never blocks or delays anything else if it can't
   * run.
   */
  function initThirdPartyAnalytics() {
    if (analyticsInitialized || !navigator.onLine) return;
    analyticsInitialized = true;
    loadGoogleAnalytics();
    loadMicrosoftClarity();
  }

  // Deferred to the window 'load' event — the same point the service
  // worker registers above — so this never competes with or delays
  // Pebble's own initial render/paint. If the device is already
  // online at that point, analytics starts immediately; if it's
  // offline, a one-time 'online' listener starts it the moment
  // connectivity returns, silently, with no user-visible change.
  window.addEventListener('load', () => {
    if (navigator.onLine) {
      initThirdPartyAnalytics();
    } else {
      window.addEventListener('online', initThirdPartyAnalytics, { once: true });
    }
  });
})();