/* ================================================================
    PEBBLE
    Version 0.9.0
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
                CATEGORY_MAP, not a separate list) and loadState()
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
                the existing CATEGORY_MAP — with no changes to
                expenses, budget, filters, storage, validation, or
                the chart. Panel open/close follows the same
                show/hide + delayed-hidden pattern already used for
                the bottom sheets, just animating a horizontal slide
                instead of a vertical one.
   ================================================================ */

document.addEventListener('DOMContentLoaded', () => {

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

  // History filters (PHASE 7) — static buttons already in the
  // markup; captured once since the set never changes at runtime.
  const filterButtons = document.querySelectorAll('#history-filters .filter-btn');
  const filterDescriptionEl = document.getElementById('filter-description');

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


  /* ================================================================
     2. APPLICATION STATE
     `expenses` and `budget` are the single source of truth for the
     whole app. The DOM is a rendered projection of this state —
     never the other way around. Nothing should ever exist only in
     the DOM.
     ================================================================ */

  const expenses = [];

  // Temporary in-memory budget. No persistence yet — this is the
  // one value later phases (LocalStorage, backend) will replace.
  // Everything downstream already reads from this variable, so
  // swapping its source later requires no changes elsewhere.
  let budget = 10000;

  // When not null, the Add Expense screen is being reused to edit
  // an existing expense (identified by id) rather than create a
  // new one. See PHASE 5.
  let editingExpenseId = null;

  // The active time filter (PHASE 7). Never touches `expenses`
  // itself — it only decides what applyCurrentFilter() returns.
  // Intentionally in-memory only; not persisted (see PHASE 6 note
  // in the LOCAL PERSISTENCE section). Defaults to 'today' (PHASE
  // 7.6) so Pebble always opens showing today's spending.
  let currentFilter = 'today';

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


  /* ================================================================
     3. CATEGORY DATA
     Single source of truth for category UI. All category buttons
     and expense card icons are generated from this array.
     ================================================================ */

  const CATEGORIES = [
    { id: 'food',          name: 'Food',          icon: '🍔', color: 'var(--category-food)' },
    { id: 'transport',     name: 'Transport',     icon: '🚕', color: 'var(--category-transport)' },
    { id: 'shopping',      name: 'Shopping',      icon: '🛍️', color: 'var(--category-shopping)' },
    { id: 'health',        name: 'Health',        icon: '💊', color: 'var(--category-health)' },
    { id: 'college',       name: 'College',       icon: '🎓', color: 'var(--category-college)' },
    { id: 'hostel',        name: 'Hostel',        icon: '🏠', color: 'var(--category-hostel)' },
    { id: 'entertainment', name: 'Entertainment', icon: '🎮', color: 'var(--category-entertainment)' },
    { id: 'others',        name: 'Others',        icon: '📦', color: 'var(--category-others)' }
  ];

  // Quick id -> category lookup, used whenever an expense card needs
  // its name/icon resolved.
  const CATEGORY_MAP = new Map(CATEGORIES.map((category) => [category.id, category]));


  /* ================================================================
     4. SHARED FORMATTERS
     Created once and reused everywhere instead of being
     instantiated on every render — cheaper and keeps formatting
     consistent across the app.
     ================================================================ */

  const currencyFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2
  });

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
   * @param {{id: string, name: string, icon: string}} category
   * @returns {HTMLButtonElement}
   */
  function createCategoryButton(category) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'category-btn';
    button.dataset.category = category.id;
    button.setAttribute('aria-label', category.name);

    const icon = document.createElement('span');
    icon.className = 'category-icon';
    icon.textContent = category.icon;

    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = category.name;

    button.append(icon, name);
    button.addEventListener('click', () => selectCategory(button));

    return button;
  }

  /**
   * Clears and rebuilds the category selector from CATEGORIES.
   * Called once on load; safe to call again if categories ever
   * become dynamic (e.g. user-defined categories in a later phase).
   */
  function renderCategories() {
    categorySelector.innerHTML = '';
    CATEGORIES.forEach((category) => {
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
     9. FORM RESET (PHASE 2)
     ================================================================ */

  /**
   * Clears amount, category selection, and note back to defaults.
   * Also exits edit mode (if active) and restores the Add Expense
   * screen's default title/button label. Called after a successful
   * save and when navigating back.
   */
  function resetForm() {
    addExpenseForm.reset();
    categoryHiddenInput.value = '';
    noteInput.value = '';
    categorySelector.querySelectorAll('.category-btn').forEach((btn) => {
      btn.classList.remove('category-btn-selected');
    });

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
   * @param {{id: string, amount: number, category: string, note: string, createdAt: string}} expense
   * @returns {HTMLLIElement}
   */
  function createExpenseCard(expense) {
    const categoryData = CATEGORY_MAP.get(expense.category);

    const item = document.createElement('li');
    item.className = 'expense-item';
    item.dataset.category = expense.category;
    item.dataset.expenseId = expense.id;

    // Icon
    const icon = document.createElement('span');
    icon.className = 'expense-category-icon';
    icon.textContent = categoryData ? categoryData.icon : '✨';
    icon.setAttribute('aria-hidden', 'true');

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
    timestamp.textContent = dateFormatter.format(new Date(expense.createdAt));
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
   * Shows the "no expenses yet" state when the given list is empty,
   * hides it otherwise. Reflects whatever list renderExpenses() was
   * given — so filtering into an empty result correctly shows the
   * empty state even if `expenses` itself isn't empty.
   * @param {Array} expenseList
   */
  function toggleEmptyState(expenseList) {
    expenseHistoryEmpty.hidden = expenseList.length > 0;
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
   */
  function renderExpenses(expenseList = expenses) {
    expenseHistoryList.innerHTML = '';

    [...expenseList]
      .reverse()
      .forEach((expense) => {
        expenseHistoryList.appendChild(createExpenseCard(expense));
      });

    toggleEmptyState(expenseList);
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
   * Derives the full set of dashboard data from a list of expenses
   * and a budget. Accepts `expenses` as a parameter (rather than
   * closing over the outer array directly) so that a *filtered*
   * array can be passed in later without changing this function.
   *
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
    // ---- Total spent: always summed fresh, never incremented. ----
    const totalSpent = expenseList.reduce((sum, expense) => sum + expense.amount, 0);

    // ---- Remaining budget: always (budget - totalSpent). ----
    const remainingBudget = budgetAmount - totalSpent;

    // ---- Budget usage percentage, clamped to 100 for display. ----
    const spendingPercentage = budgetAmount > 0
      ? Math.min((totalSpent / budgetAmount) * 100, 100)
      : 0;

    // ---- Category totals: single pass over the expense list. ----
    const categoryTotals = new Map();
    expenseList.forEach((expense) => {
      const current = categoryTotals.get(expense.category) || 0;
      categoryTotals.set(expense.category, current + expense.amount);
    });

    // ---- Category breakdown: only categories with spending,      ----
    // ---- sorted highest first. Percentages of both budget and    ----
    // ---- total spent are precomputed here so no consumer (bar,   ----
    // ---- summary, chart) ever recalculates a percentage itself.  ----
    const categoryBreakdown = CATEGORIES
      .map((category) => ({
        id: category.id,
        name: category.name,
        icon: category.icon,
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
     ================================================================ */

  /**
   * Resolves a category's CSS custom property (defined in
   * style.css) to its computed color value, so colors are never
   * duplicated or hardcoded here — style.css stays the one source
   * of truth for the palette.
   * @param {string} categoryId
   * @returns {string} a CSS color value, e.g. "#F97316"
   */
  function getCategoryColor(categoryId) {
    return getComputedStyle(document.documentElement)
      .getPropertyValue(`--category-${categoryId}`)
      .trim();
  }

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
   * Single entry point for refreshing dashboard numbers. Recomputes
   * from whichever expense list it's given (full or filtered) plus
   * `budget`, and re-renders every dashboard piece. Defaults to the
   * full `expenses` array so existing callers keep working
   * unchanged. Any future feature that changes data (delete, edit,
   * filter, budget update) should only touch state and then call
   * this — nothing else.
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
    updateDashboard(applyCurrentFilter(expenses));
    closeBudgetSheet();
  });


  /* ================================================================
     15. EXPENSE MANAGEMENT — EDIT & DELETE (PHASE 5)
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
   */
  function deleteExpense(id) {
    const confirmed = window.confirm(
      'Delete this expense?\n\nThis action cannot be undone.'
    );
    if (!confirmed) return;

    const index = expenses.findIndex((expense) => expense.id === id);
    if (index === -1) return;

    expenses.splice(index, 1);

    saveState();
    refreshUI();
  }

  /**
   * Enters edit mode for an existing expense: preloads the Add
   * Expense screen with its amount, category, and note, relabels
   * the screen so it's clear this is an edit rather than a new
   * entry, and remembers the id being edited so the submit handler
   * knows to update instead of create.
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

    addExpenseTitle.textContent = 'Edit Expense';
    saveExpenseBtn.textContent = 'Save Changes';

    showAddExpenseScreen();
  }


  /* ================================================================
     16. FORM SUBMISSION (PHASE 2 + PHASE 3 + REFINEMENT + PHASE 4 + PHASE 5)
     ================================================================ */

  addExpenseForm.addEventListener('submit', (event) => {
    event.preventDefault();

    const amountValue = parseFloat(amountInput.value);
    const categoryValue = categoryHiddenInput.value;

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

    if (editingExpenseId) {
      // ---- Edit path: update fields in place. id and createdAt ----
      // ---- are intentionally left untouched.                   ----
      const expense = findExpenseById(editingExpenseId);
      if (expense) {
        expense.amount = roundToTwoDecimals(amountValue);
        expense.category = categoryValue;
        expense.note = noteInput.value.trim();
      }
    } else {
      // ---- Create path ----
      const expense = {
        id: generateId(),
        amount: roundToTwoDecimals(amountValue),
        category: categoryValue,
        note: noteInput.value.trim(),
        createdAt: new Date().toISOString()
      };
      expenses.push(expense);
    }

    // ---- Update memory first, then persist, then re-render ----
    saveState();
    refreshUI();
    resetForm();
    showHomeScreen();
  });


  /* ================================================================
     17. LOCAL PERSISTENCE (PHASE 6)
     LocalStorage is storage, not state. `expenses` and `budget`
     remain the single source of truth in memory at all times — this
     section only ever reads them (to save) or writes into them
     (to load). Nothing here renders anything or is read from
     directly by any render function.

     Flow:
       Startup      -> loadState() populates expenses + budget
       User change  -> mutation updates memory -> saveState() ->
                        renderExpenses() -> updateDashboard()
     ================================================================ */

  const STORAGE_KEY = 'pebble-data';

  /**
   * Checks a single expense loaded from LocalStorage against
   * Pebble's schema. Everything from LocalStorage is untrusted, so
   * this is deliberately strict — an expense that fails any single
   * check is rejected outright rather than repaired, since silently
   * rewriting corrupted data (e.g. forcing an unknown category to
   * "Others") would hide the corruption instead of discarding it.
   * @param {*} expense
   * @returns {boolean}
   */
  function isValidExpense(expense) {
    if (!expense || typeof expense !== 'object') return false;

    const hasValidId = typeof expense.id === 'string' && expense.id.trim() !== '';
    const hasValidAmount = Number.isFinite(expense.amount) && expense.amount > 0;
    const hasValidCategory = CATEGORY_MAP.has(expense.category);
    const createdAtTime = new Date(expense.createdAt).getTime();
    const hasValidCreatedAt =
      expense.createdAt !== null &&
      !Number.isNaN(createdAtTime) &&
      createdAtTime <= Date.now();
    const hasValidNote = expense.note === undefined || typeof expense.note === 'string';

    return hasValidId && hasValidAmount && hasValidCategory && hasValidCreatedAt && hasValidNote;
  }

  /**
   * Loads persisted state from LocalStorage into the existing
   * `expenses` array and `budget` variable. Both are mutated in
   * place (expenses.length reset + push) rather than reassigned,
   * since `expenses` is declared `const` and every other part of
   * the app already holds a reference to it.
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
      clearState();
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

    if (Array.isArray(parsed.expenses)) {
      expenses.length = 0;
      parsed.expenses
        .filter(isValidExpense)
        .forEach((expense) => expenses.push(expense));
    }
  }

  /**
   * Persists the current in-memory `budget` and `expenses` to
   * LocalStorage. Saves nothing else. Called after every successful
   * mutation (add, edit, delete, budget change) — never on its own
   * as a substitute for updating memory first.
   */
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ budget, expenses }));
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
     18. EXPENSE FILTERING (PHASE 7 + PHASE 7.5)
     `expenses` is never filtered in place — it stays the single
     source of truth, untouched. This section's only job is to
     decide, from `currentFilter` (and, for Custom, `customDateRange`),
     which subset of `expenses` should currently be displayed, and
     to refresh the UI with that subset.

     Flow:
       expenses (master array)
             │
             ▼
       currentFilter
             │
             ▼
       applyCurrentFilter()
             │
             ▼
       filteredExpenses
             │
             ├── renderExpenses(filteredExpenses)
             └── updateDashboard(filteredExpenses)

     renderExpenses() and updateDashboard() (PHASE 3/4) don't know
     or care whether the list they're given is filtered — that
     decision lives entirely here, in one place. The Custom filter
     (PHASE 7.5) is not a special case anywhere else in the app: it
     just makes applyCurrentFilter() check an upper bound as well as
     a lower one.
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
    const filteredExpenses = applyCurrentFilter(expenses);
    renderExpenses(filteredExpenses);
    updateDashboard(filteredExpenses);
    renderFilterDescription(generateFilterDescription(filteredExpenses));
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
     20. CSV EXPORT (PHASE 10)
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
   * Reuses CATEGORY_MAP for the category name shown in the UI,
   * rather than exporting the raw category id, and reuses
   * formatDateForInput for a plain, spreadsheet-friendly date.
   * @returns {string}
   */
  function buildExpensesCsv() {
    const header = ['Date', 'Amount', 'Category', 'Note'];
    const rows = expenses.map((expense) => {
      const date = formatDateForInput(new Date(expense.createdAt));
      const category = CATEGORY_MAP.get(expense.category)?.name || expense.category;
      const note = expense.note || '';
      return [date, expense.amount.toFixed(2), category, note];
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
     21. INITIALIZATION
     ================================================================ */

  loadState();
  renderCategories();
  updateFilterButtonStates(currentFilter);
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