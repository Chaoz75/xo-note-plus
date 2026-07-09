/* ═══════════════════════════════════════════════════════
   XO NOTE+ — Main Application Logic V6
   WYSIWYG Editor + Dashboard + Block Sizes + Custom Icons + Widgets
   Header toggle + Code block collapsible + Drag reorder + User name + Premium widgets
   ═══════════════════════════════════════════════════════ */

const App = {
  // ── State ──
  vaultPath: null,
  currentFile: null,
  openTabs: [],
  activeTabIndex: -1,
  fileTree: [],
  starred: [],
  recentFiles: [],
  colorTags: {},
  blockSizes: {},
  customIcons: {},
  colorTagStyles: {},
  folderHistory: [],
  currentFolderPath: null,
  autoSaveTimer: null,
  previewMode: false,
  editorMode: 'visual',
  contextMenuVisible: false,
  dashboardInterval: null,
  textColorValue: '#ffffff',
  highlightColorValue: '#ffff00',
  sortOrder: {},
  pinnedFolders: [],
  clockFaceStyle: 0,
  dateFaceStyle: 0,
  stopwatchFaceStyle: 0,
  stopwatchRunning: false,
  stopwatchStart: 0,
  stopwatchElapsed: 0,
  stopwatchInterval: null,
  calendarDotColors: {},
  stickyNotes: [],
  stickyTasks: [],
  leftRailHidden: false,
  rightSidebarHidden: false,
  dashboardLocked: true,
  leftRailWidth: 200,
  settings: {
    theme: 'theme-dark-default',
    accent: '#4fc3f7',
    gradientIntensity: 0.5,
    gradientAnimate: true,
    fontSize: 14,
    editorFont: "'JetBrains Mono', monospace",
    uiFont: "'Inter', sans-serif",
    uiFontWeight: '400',
    autoSave: true,
    showExtensions: true,
    confirmDelete: true,
    brightness: 1,
    projectTabMode: false,
    logoGlowColor: '#4fc3f7',
    userName: '',
    clocks: [
      { label: 'Local', tz: 'local' },
      { label: 'EST', tz: 'America/New_York' },
      { label: 'PST', tz: 'America/Los_Angeles' }
    ],
    showClocks: true,
    showCalendar: true,
    calendarCollapsed: false,
    backgroundStyle: 'gradient', // 'gradient' | 'solid' | 'image' — the background layer
    glassMode: false, // independent see-through-panels toggle, works over any background layer above
    backgroundSolidColor: '#0a0a14',
    customBackgroundPath: null,
    customBackgroundBlur: 0,
    dashCalendarBg: null,
    dashKbdColor: null,
    dashTimeColor: null,
    dashWelcomeColor: null,
    searchBarStyle: 'solid',
    tabBarStyle: 'solid',
    accentOutlineColor: null,
    accentBrightness: 1,
    accentGradientEnabled: false,
    accentGradientColor2: '#ff8a65',
    accentGradientColor2Custom: false, // becomes true once the user manually picks color 2, so we stop auto-deriving it
    showLogo: true,
    timeFormat: '12',
    uiFontSize: 13,
    dashboardScale: 'default',
    dashboardTheme: 'classic',
    widgetPositions: {},
    widgetSizes: {},
    glowSyncAll: false,
    glowMatchIntensity: false,
    leftRailWidth: 200,
    showKeyboardShortcuts: true,
    autoUpdateEnabled: true,
    showStickyNotes: true,
    showStickyTasks: true,
    dashboardColorLink: false,
    customTheme: {
      mode: 'gradient',      // 'solid' | 'gradient'
      color1: '#0a0a14',
      color2: '#1a1a3e',
      angle: 135,
      spread: 100,           // how far the gradient reaches (%)
      accent: '#4fc3f7'
    }
  },

  // Debounced settings save — lets sliders/color wheels drag smoothly
  // without writing the config file on every tick
  _saveTimer: null,
  _scheduleSaveSettings() {
    if (this._saveTimer) clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => { this._saveTimer = null; this.saveSettings(); }, 500);
  },
  contextTarget: null,

  // ── Init ──
  async init() {
    await this.loadSettings();
    this.vaultPath = await window.xo.getVaultPath();

    if (!this.vaultPath) {
      document.getElementById('setup-wizard').classList.remove('hidden');
      document.getElementById('app').classList.add('hidden');
    } else {
      document.getElementById('setup-wizard').classList.add('hidden');
      document.getElementById('app').classList.remove('hidden');
      await this.loadFileTree();
      this.renderRecent();
      this.renderStarred();
    }

    this.bindEvents();
    this.applySettings();
    this.initChangelog();
    this.initAutoUpdate();
    this.startDailyQuoteRotation();
    this.initFontSelectPreviews();
    this.startClocks();
    this.startWidgetBarClocks();
    this.renderWidgetCalendar();
    this.updateWidgetVisibility();
    this.updateEditorModeUI();
    this.updateDateWidget();
    this.renderSpaces();
    this.renderLeftRailRecent();
    this.renderLeftRailStarred();
    this.initCollapsibleSections();
    this.initStopwatch();
    this.initDashboardWidgets();
    this.initLeftRailResize();

    // Show dashboard if no tabs open
    if (this.openTabs.length === 0 && this.vaultPath) {
      this.showDashboard();
    }

    // ── Files opened from Windows (double-click / "Open with") ──
    // Pushed while the app is running (single-instance hand-off)
    if (window.xo.onOpenFilePath) {
      window.xo.onOpenFilePath((p) => this.openExternalPath(p));
    }
    // Passed on the command line at startup
    if (window.xo.getPendingOpenFile) {
      try {
        const pending = await window.xo.getPendingOpenFile();
        if (pending) this.openExternalPath(pending);
      } catch (e) { }
    }
  },

  // Open a file that came from outside the app (absolute OS path)
  openExternalPath(filePath) {
    if (!filePath) return;
    const name = filePath.split(/[\\/]/).pop();
    this.openFile(filePath, name);
  },

  // ── Settings ──
  async loadSettings() {
    try {
      const config = await window.xo.loadConfig();
      if (config.settings) this.settings = { ...this.settings, ...config.settings };
      if (config.starred) this.starred = config.starred;
      if (config.recentFiles) this.recentFiles = config.recentFiles;
      if (config.colorTags) this.colorTags = config.colorTags;
      if (config.blockSizes) this.blockSizes = config.blockSizes;
      if (config.customIcons) this.customIcons = config.customIcons;
      if (config.colorTagStyles) this.colorTagStyles = config.colorTagStyles;
      if (config.sortOrder) this.sortOrder = config.sortOrder;
      if (config.pinnedFolders) this.pinnedFolders = config.pinnedFolders;
      if (config.clockFaceStyle !== undefined) this.clockFaceStyle = config.clockFaceStyle;
      if (config.dateFaceStyle !== undefined) this.dateFaceStyle = config.dateFaceStyle;
      if (config.stopwatchFaceStyle !== undefined) this.stopwatchFaceStyle = config.stopwatchFaceStyle;
      if (config.calendarDotColors) this.calendarDotColors = config.calendarDotColors;
      if (config.stickyNotes) this.stickyNotes = config.stickyNotes;
      if (config.stickyTasks) this.stickyTasks = config.stickyTasks;
      if (config.dashboardLocked !== undefined) this.dashboardLocked = config.dashboardLocked;
      if (config.leftRailWidth !== undefined) this.leftRailWidth = config.leftRailWidth;
    } catch (e) { }
  },

  async saveSettings() {
    await window.xo.saveConfig({
      settings: this.settings,
      starred: this.starred,
      recentFiles: this.recentFiles,
      colorTags: this.colorTags,
      blockSizes: this.blockSizes,
      customIcons: this.customIcons,
      colorTagStyles: this.colorTagStyles,
      sortOrder: this.sortOrder,
      pinnedFolders: this.pinnedFolders,
      clockFaceStyle: this.clockFaceStyle,
      dateFaceStyle: this.dateFaceStyle,
      stopwatchFaceStyle: this.stopwatchFaceStyle,
      calendarDotColors: this.calendarDotColors,
      stickyNotes: this.stickyNotes,
      stickyTasks: this.stickyTasks,
      dashboardLocked: this.dashboardLocked,
      leftRailWidth: this.leftRailWidth
    });
  },

  applySettings() {
    const s = this.settings;
    document.body.className = s.theme;
    document.body.setAttribute('data-gradient-intensity', s.gradientIntensity);
    document.body.setAttribute('data-gradient-animate', s.gradientAnimate);
    this.applyCustomTheme();
    document.documentElement.style.setProperty('--accent', s.accent);
    document.documentElement.style.setProperty('--accent-dim', s.accent + '22');
    document.documentElement.style.setProperty('--accent-hover', s.accent + '44');
    document.documentElement.style.setProperty('--accent-glow', s.accent + '28');
    this.applyAccentExtras();

    // Compute theme-accent variants from --text-accent (theme-specific color)
    // This is used by dashboard themes (like Retro Terminal) when color-linked is ON
    // IMPORTANT: read from document.body (where theme class is applied), not documentElement
    const bodyStyle = getComputedStyle(document.body);
    let themeAccent = bodyStyle.getPropertyValue('--text-accent').trim();
    // Fall back to user accent if theme doesn't define its own
    if (!themeAccent) {
      themeAccent = s.accent;
    }
    // If it resolved to an rgb() value, convert to hex for alpha-suffix math
    if (themeAccent.startsWith('rgb')) {
      const nums = themeAccent.match(/\d+/g);
      if (nums && nums.length >= 3) {
        themeAccent = '#' + nums.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('');
      }
    }
    document.documentElement.style.setProperty('--theme-accent', themeAccent);
    document.documentElement.style.setProperty('--theme-accent-soft', themeAccent + '20');
    document.documentElement.style.setProperty('--theme-accent-border', themeAccent + '70');
    document.documentElement.style.setProperty('--theme-accent-bg', themeAccent + '18');

    // Detect light vs dark theme for dashboard adaptations
    const bgPrimary = bodyStyle.getPropertyValue('--bg-primary').trim();
    let isLightTheme = false;
    if (bgPrimary) {
      // Parse bg-primary to check brightness
      let r = 0, g = 0, b = 0;
      if (bgPrimary.startsWith('#')) {
        const hex = bgPrimary.replace('#', '');
        r = parseInt(hex.substr(0, 2), 16);
        g = parseInt(hex.substr(2, 2), 16);
        b = parseInt(hex.substr(4, 2), 16);
      } else if (bgPrimary.startsWith('rgb')) {
        const nums = bgPrimary.match(/\d+/g);
        if (nums) { r = +nums[0]; g = +nums[1]; b = +nums[2]; }
      }
      isLightTheme = (r + g + b) / 3 > 128;
    }
    document.body.setAttribute('data-theme-brightness', isLightTheme ? 'light' : 'dark');
    document.documentElement.style.setProperty('--theme-accent-glow', themeAccent + '55');
    document.documentElement.style.setProperty('--theme-accent-dim', themeAccent + '33');
    document.documentElement.style.setProperty('--font-editor', s.fontSize + 'px');
    document.documentElement.style.setProperty('--font-editor-family', s.editorFont);
    document.documentElement.style.setProperty('--font-ui', s.uiFont);
    document.documentElement.style.setProperty('--font-ui-weight', s.uiFontWeight);
    document.body.setAttribute('data-ui-weight', s.uiFontWeight);

    const gradBg = document.getElementById('gradient-bg');
    if (gradBg) gradBg.style.opacity = s.gradientIntensity;

    // Brightness
    const container = document.querySelector('.app-container');
    if (container) container.style.filter = 'brightness(' + s.brightness + ')';

    // Logo widget — always max size (180px)
    const logoBox = document.querySelector('.widget-logo-box');
    if (logoBox) {
      logoBox.style.width = '180px';
      logoBox.style.height = '180px';
      logoBox.style.boxShadow = '0 0 30px ' + s.logoGlowColor + '44';
    }

    // Apply glow sync to all widgets if enabled
    if (s.glowSyncAll) {
      const glowColor = s.logoGlowColor;
      const glowIntensity = s.glowMatchIntensity ? '44' : '22';
      const clockBox = document.querySelector('.widget-clock-box');
      if (clockBox) clockBox.style.boxShadow = '0 0 20px ' + glowColor + glowIntensity;
      const dateBox = document.querySelector('.widget-date-box');
      if (dateBox) dateBox.style.boxShadow = '0 0 20px ' + glowColor + glowIntensity;
      const stopwatchBox = document.querySelector('.widget-stopwatch-box');
      if (stopwatchBox) stopwatchBox.style.boxShadow = '0 0 20px ' + glowColor + glowIntensity;
      if (s.glowMatchIntensity) {
        const dateNum = document.querySelector('.widget-date-number');
        if (dateNum) dateNum.style.textShadow = '0 0 20px ' + glowColor;
      }
    }

    // Theme cards
    document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.theme === s.theme));
    document.querySelectorAll('.accent-dot').forEach(d => d.classList.toggle('active', d.dataset.accent === s.accent));

    // Sliders & toggles
    const gi = document.getElementById('gradient-intensity');
    if (gi) gi.value = s.gradientIntensity;
    const ga = document.getElementById('gradient-animate');
    if (ga) ga.checked = s.gradientAnimate;
    const gf = document.getElementById('global-font-size');
    if (gf) { gf.value = s.fontSize; }
    const fsl = document.getElementById('font-size-label');
    if (fsl) fsl.textContent = s.fontSize + 'px';
    const fs = document.getElementById('font-size-select');
    if (fs) fs.value = s.fontSize;
    const as = document.getElementById('auto-save-toggle');
    if (as) as.checked = s.autoSave;
    const vp = document.getElementById('vault-path-display');
    if (vp && this.vaultPath) vp.textContent = this.vaultPath;

    // Font selects
    const ef = document.getElementById('editor-font-select');
    if (ef) ef.value = s.editorFont;
    const uf = document.getElementById('ui-font-select');
    if (uf) uf.value = s.uiFont;
    const uw = document.getElementById('ui-font-weight');
    if (uw) uw.value = s.uiFontWeight;

    // Brightness slider + label
    const bs = document.getElementById('brightness-slider');
    if (bs) bs.value = s.brightness;
    const bl = document.getElementById('brightness-label');
    if (bl) bl.textContent = Math.round(s.brightness * 100) + '%';

    // Project tab mode
    const ptm = document.getElementById('project-tab-mode');
    if (ptm) ptm.checked = s.projectTabMode;

    // Show extensions / confirm delete
    const se = document.getElementById('show-extensions');
    if (se) se.checked = s.showExtensions;
    const cd = document.getElementById('confirm-delete');
    if (cd) cd.checked = s.confirmDelete;

    // Widget toggles
    const sct = document.getElementById('show-clocks-toggle');
    if (sct) sct.checked = s.showClocks;
    const scalt = document.getElementById('show-calendar-toggle');
    if (scalt) scalt.checked = s.showCalendar;
    const slt = document.getElementById('show-logo-toggle');
    if (slt) slt.checked = s.showLogo;

    // User name input
    const unInput = document.getElementById('user-name-input');
    if (unInput) unInput.value = s.userName;

    // Time format select
    const tfs = document.getElementById('time-format-select');
    if (tfs) tfs.value = s.timeFormat || '12';

    // UI font size
    document.body.setAttribute('data-ui-font-size', s.uiFontSize || 13);
    document.body.style.fontSize = (s.uiFontSize || 13) + 'px';
    const uifs = document.getElementById('ui-font-size-slider');
    if (uifs) uifs.value = s.uiFontSize || 13;
    const uifsl = document.getElementById('ui-font-size-label');
    if (uifsl) uifsl.textContent = (s.uiFontSize || 13) + 'px';

    // Dashboard scale
    const dash = document.getElementById('home-dashboard');
    if (dash) {
      dash.classList.remove('dashboard-scale-large', 'dashboard-scale-xl');
      if (s.dashboardScale === 'large') dash.classList.add('dashboard-scale-large');
      else if (s.dashboardScale === 'xl') dash.classList.add('dashboard-scale-xl');
    }
    const dss = document.getElementById('dashboard-scale-select');
    if (dss) dss.value = s.dashboardScale || 'default';

    // Dashboard theme
    if (dash) {
      dash.classList.remove('dashboard-theme-classic', 'dashboard-theme-midnight', 'dashboard-theme-focus', 'dashboard-theme-mission', 'dashboard-theme-horizon', 'dashboard-theme-aurora', 'dashboard-theme-neon-district', 'dashboard-theme-zen-garden', 'dashboard-theme-retro-terminal', 'dashboard-theme-glass-morphic');
      const theme = s.dashboardTheme || 'classic';
      dash.classList.add('dashboard-theme-' + theme);
    }
    const dts = document.getElementById('dashboard-theme-select');
    if (dts) dts.value = s.dashboardTheme || 'classic';

    // Dashboard color link
    if (dash) {
      if (s.dashboardColorLink) {
        dash.classList.add('dashboard-color-linked');
      } else {
        dash.classList.remove('dashboard-color-linked');
      }
    }
    const dcl = document.getElementById('dashboard-color-link-toggle');
    if (dcl) dcl.checked = !!s.dashboardColorLink;

    this.applyDashboardColorOverrides();
    this.applyBarStyles();

    // Keyboard shortcuts visibility
    const sks = document.getElementById('show-shortcuts-toggle');
    if (sks) sks.checked = s.showKeyboardShortcuts !== false;
    const shortcutsArea = document.querySelector('.dashboard-shortcuts');
    if (shortcutsArea) shortcutsArea.style.display = (s.showKeyboardShortcuts !== false) ? '' : 'none';

    // Auto Update toggle
    const autoUpd = document.getElementById('auto-update-toggle');
    if (autoUpd) autoUpd.checked = s.autoUpdateEnabled !== false;

    // Sticky notes and tasks visibility — hide the entire sticky sections, not just panels
    const ssn = document.getElementById('show-sticky-notes-toggle');
    if (ssn) ssn.checked = s.showStickyNotes !== false;
    const sst = document.getElementById('show-sticky-tasks-toggle');
    if (sst) sst.checked = s.showStickyTasks !== false;
    // Hide entire sticky section containers (header + panel)
    const stickySections = document.querySelectorAll('.dashboard-sticky-section');
    if (stickySections.length >= 2) {
      stickySections[0].style.display = (s.showStickyTasks !== false) ? '' : 'none';
      stickySections[1].style.display = (s.showStickyNotes !== false) ? '' : 'none';
    }
    // Hide entire stickies container if both are off
    const stickiesContainer = document.querySelector('.dashboard-stickies');
    if (stickiesContainer) {
      const bothOff = (s.showStickyNotes === false) && (s.showStickyTasks === false);
      stickiesContainer.style.display = bothOff ? 'none' : '';
    }
    const stickyNotesPanel = document.getElementById('sticky-notes-panel');
    if (stickyNotesPanel) stickyNotesPanel.style.display = (s.showStickyNotes !== false) ? '' : 'none';
    const stickyTasksPanel = document.getElementById('sticky-tasks-panel');
    if (stickyTasksPanel) stickyTasksPanel.style.display = (s.showStickyTasks !== false) ? '' : 'none';

    // Custom theme builder: visibility + sync inputs
    const builder = document.getElementById('custom-theme-builder');
    if (builder) {
      builder.classList.toggle('hidden', s.theme !== 'theme-custom');
      const ct = s.customTheme || {};
      const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v; };
      setVal('custom-color1', ct.color1 || '#0a0a14');
      setVal('custom-color1-hex', ct.color1 || '#0a0a14');
      setVal('custom-color2', ct.color2 || '#1a1a3e');
      setVal('custom-color2-hex', ct.color2 || '#1a1a3e');
      setVal('custom-accent', ct.accent || '#4fc3f7');
      setVal('custom-accent-hex', ct.accent || '#4fc3f7');
      const angleVal = ct.angle !== undefined ? ct.angle : 135;
      setVal('custom-angle', angleVal);
      const al = document.getElementById('custom-angle-label');
      if (al) al.textContent = angleVal + '°';
      const spreadVal = ct.spread !== undefined ? ct.spread : 100;
      setVal('custom-spread', spreadVal);
      const spl = document.getElementById('custom-spread-label');
      if (spl) spl.textContent = spreadVal + '%';
      document.querySelectorAll('.grad-dir-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.angle) === angleVal));
      const isGradient = (ct.mode || 'gradient') === 'gradient';
      document.querySelectorAll('.custom-bg-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === (ct.mode || 'gradient')));
      ['custom-color2-row', 'custom-direction-row', 'custom-angle-row', 'custom-spread-row'].forEach(id => {
        const row = document.getElementById(id);
        if (row) row.style.display = isGradient ? '' : 'none';
      });
      const c1label = document.getElementById('custom-color1-label');
      if (c1label) c1label.textContent = isGradient ? 'Color 1' : 'Background Color';
    }

    this.applyBackgroundStyle();

    this.updateFontPreview();
  },

  // ── Background Style: which layer sits behind the app ──
  // 'gradient' = animated gradient (default)
  // 'solid'    = flat color
  // 'image'    = custom uploaded image (blurrable)
  // Glass Mode (settings.glassMode) is a separate on/off toggle handled
  // below — it layers see-through panels over whichever of the 3 above
  // is active, instead of being a 4th mutually-exclusive option.
  applyBackgroundStyle() {
    const s = this.settings;
    const style = s.backgroundStyle || 'gradient';

    const gradEl = document.getElementById('gradient-bg');
    const imageEl = document.getElementById('custom-bg-image');
    const solidEl = document.getElementById('custom-bg-solid');

    // Only one background layer is visible at a time
    if (gradEl) gradEl.classList.toggle('hidden', style !== 'gradient');
    if (solidEl) solidEl.classList.toggle('hidden', style !== 'solid');
    if (imageEl) imageEl.classList.toggle('hidden', style !== 'image');

    if (solidEl) solidEl.style.background = s.backgroundSolidColor || '#0a0a14';
    if (imageEl && s.customBackgroundPath) {
      imageEl.style.backgroundImage = 'url("' + s.customBackgroundPath.replace(/\\/g, '/') + '")';
      imageEl.style.filter = 'blur(' + (s.customBackgroundBlur || 0) + 'px)';
    }

    // Glass is its own on/off toggle now — independent of which background
    // layer is showing, so it can pair with Gradient, Solid, or Custom Image.
    document.body.classList.toggle('full-gradient-mode', !!s.glassMode);

    // Settings UI: selected option + which sub-controls are relevant
    const select = document.getElementById('background-style-select');
    if (select) select.value = style;
    const hint = document.getElementById('background-style-hint');
    const hints = {
      gradient: 'Animated multi-color gradient behind the app.',
      solid: 'A flat color behind the app.',
      image: 'Your chosen image behind the app, blur adjustable below.'
    };
    if (hint) hint.textContent = hints[style] || hints.gradient;

    const glassToggle = document.getElementById('glass-mode-toggle');
    if (glassToggle) glassToggle.checked = !!s.glassMode;

    const solidGroup = document.getElementById('background-solid-group');
    if (solidGroup) solidGroup.classList.toggle('hidden', style !== 'solid');
    const imageGroup = document.getElementById('background-image-group');
    if (imageGroup) imageGroup.classList.toggle('hidden', style !== 'image');
    const blurGroup = document.getElementById('bg-blur-group');
    if (blurGroup) blurGroup.classList.toggle('hidden', style !== 'image');

    const solidColor = document.getElementById('background-solid-color');
    if (solidColor) solidColor.value = s.backgroundSolidColor || '#0a0a14';
    const solidHex = document.getElementById('background-solid-color-hex');
    if (solidHex) solidHex.value = s.backgroundSolidColor || '#0a0a14';

    const statusEl = document.getElementById('custom-bg-status');
    if (statusEl) statusEl.textContent = s.customBackgroundPath ? 'Custom background active.' : 'No custom background set.';
    const blurSlider = document.getElementById('bg-blur-slider');
    if (blurSlider) blurSlider.value = s.customBackgroundBlur || 0;
    const blurLabel = document.getElementById('bg-blur-label');
    if (blurLabel) blurLabel.textContent = (s.customBackgroundBlur || 0) + 'px';
  },

  toggleGlassMode() {
    this.settings.glassMode = !this.settings.glassMode;
    this.saveSettings();
    this.applyBackgroundStyle();
  },

  // ── Universal dashboard color overrides ──
  // Mutually exclusive with "Link Dashboard Colors to Theme": that toggle
  // (dashboardColorLink) makes these elements follow the accent color
  // automatically via the existing .dashboard-color-linked theme rules.
  // When it's off, any custom colors picked here apply instead, uniformly
  // across every dashboard theme.
  applyDashboardColorOverrides() {
    const s = this.settings;
    const group = document.getElementById('dash-custom-colors-group');
    if (group) group.classList.toggle('hidden', !!s.dashboardColorLink);

    const root = document.documentElement;
    root.style.setProperty('--dash-calendar-bg-override', s.dashCalendarBg || '');
    root.style.setProperty('--dash-kbd-color-override', s.dashKbdColor || '');
    root.style.setProperty('--dash-time-color-override', s.dashTimeColor || '');
    root.style.setProperty('--dash-welcome-color-override', s.dashWelcomeColor || '');

    const hasCustom = !s.dashboardColorLink && (s.dashCalendarBg || s.dashKbdColor || s.dashTimeColor || s.dashWelcomeColor);
    document.body.classList.toggle('dash-custom-colors', !!hasCustom);

    const setPicker = (id, val, fallback) => { const el = document.getElementById(id); if (el) el.value = val || fallback; };
    setPicker('dash-color-calendar', s.dashCalendarBg, '#1a1a2e');
    setPicker('dash-color-kbd', s.dashKbdColor, '#9090b0');
    setPicker('dash-color-time', s.dashTimeColor, '#4fc3f7');
    setPicker('dash-color-welcome', s.dashWelcomeColor, '#e8e8f4');
  },

  setDashColor(key, value) {
    this.settings[key] = value;
    this.applyDashboardColorOverrides();
    this._scheduleSaveSettings();
  },

  resetDashColor(key) {
    this.settings[key] = null;
    this.applyDashboardColorOverrides();
    this.saveSettings();
  },

  // ── Search bar / tab bar: Solid vs Gradient ──
  applyBarStyles() {
    const s = this.settings;
    document.body.classList.toggle('search-bar-gradient', s.searchBarStyle === 'gradient');
    document.body.classList.toggle('tab-bar-gradient', s.tabBarStyle === 'gradient');
    const sSel = document.getElementById('search-bar-style-select');
    if (sSel) sSel.value = s.searchBarStyle || 'solid';
    const tSel = document.getElementById('tab-bar-style-select');
    if (tSel) tSel.value = s.tabBarStyle || 'solid';
  },

  setBackgroundStyle(style) {
    this.settings.backgroundStyle = style;
    this.saveSettings();
    this.applyBackgroundStyle();
  },

  async chooseBackgroundImage() {
    try {
      const newPath = await window.xo.selectBackgroundImage();
      if (!newPath) return;
      this.settings.customBackgroundPath = newPath;
      this.saveSettings();
      this.applyBackgroundStyle();
      this.updateStatusMessage('Background image set');
    } catch (e) { this.updateStatusMessage('Could not set background image'); }
  },

  async clearBackgroundImage() {
    try {
      await window.xo.clearBackgroundImage();
    } catch (e) { }
    this.settings.customBackgroundPath = null;
    this.saveSettings();
    this.applyBackgroundStyle();
    this.updateStatusMessage('Background image removed');
  },

  // ── Custom Theme engine ──
  _hexToRgb(hex) {
    const h = (hex || '').replace('#', '');
    if (h.length !== 6) return null;
    return { r: parseInt(h.substr(0, 2), 16), g: parseInt(h.substr(2, 2), 16), b: parseInt(h.substr(4, 2), 16) };
  },
  _rgbToHex(r, g, b) {
    const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
    return '#' + c(r) + c(g) + c(b);
  },
  _hexToHsl(hex) {
    const c = this._hexToRgb(hex);
    if (!c) return null;
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s;
    const l = (max + min) / 2;
    if (max === min) { h = s = 0; }
    else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        default: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return { h: h * 360, s: s * 100, l: l * 100 };
  },
  _hslToHex(h, s, l) {
    h = ((h % 360) + 360) % 360 / 360; s = Math.max(0, Math.min(100, s)) / 100; l = Math.max(0, Math.min(100, l)) / 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; }
    else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }
    return this._rgbToHex(r * 255, g * 255, b * 255);
  },
  _shade(hex, amount) {
    // amount > 0 lightens, < 0 darkens. Works in HSL lightness (perceptual,
    // full 0-100 range) instead of adding a flat number to each RGB channel:
    // bright/saturated Color 1 values (e.g. pure yellow, pure red) already
    // have one or more channels pinned at 0 or 255, so the old per-channel
    // add clipped immediately and made bg-secondary/tertiary/elevated/hover/
    // active all collapse to nearly the same color — reading as one flat
    // "solid" box instead of the intended layered depth. HSL lightness has
    // nowhere to clip except true black/white, so it stays gradual for any
    // base color. (amount/2.55 keeps the same rough magnitude as before,
    // since the old amounts were tuned as 0-255 units.)
    const hsl = this._hexToHsl(hex);
    if (!hsl) return hex;
    const l = Math.max(0, Math.min(100, hsl.l + amount / 2.55));
    return this._hslToHex(hsl.h, hsl.s, l);
  },
  _mix(hexA, hexB, t) {
    const a = this._hexToRgb(hexA), b = this._hexToRgb(hexB);
    if (!a || !b) return hexA;
    return this._rgbToHex(a.r + (b.r - a.r) * t, a.g + (b.g - a.g) * t, a.b + (b.b - a.b) * t);
  },
  _isLightColor(hex) {
    const c = this._hexToRgb(hex);
    if (!c) return false;
    return (0.299 * c.r + 0.587 * c.g + 0.114 * c.b) / 255 > 0.5;
  },

  _adjustBrightness(hex, factor) {
    const c = this._hexToRgb(hex);
    if (!c) return hex;
    const scale = (n) => Math.max(0, Math.min(255, Math.round(n * factor)));
    return this._rgbToHex(scale(c.r), scale(c.g), scale(c.b));
  },

  // ── Accent extras: outline color, brightness, gradient ──
  // Runs after the base --accent/--accent-dim/etc are set, so it can layer
  // brightness on top of whatever accent is currently active (preset or
  // custom theme), and derive --accent-outline / --accent-bg from it.
  applyAccentExtras() {
    const s = this.settings;
    const root = document.documentElement;
    const brightAccent = this._adjustBrightness(s.accent || '#4fc3f7', s.accentBrightness || 1);

    root.style.setProperty('--accent', brightAccent);
    root.style.setProperty('--accent-dim', brightAccent + '22');
    root.style.setProperty('--accent-hover', brightAccent + '44');
    root.style.setProperty('--accent-glow', brightAccent + '28');
    root.style.setProperty('--accent-outline', s.accentOutlineColor || brightAccent);

    // Gradient 2nd color: auto-derive a shade close to the accent itself
    // (a lighter tint of the same color, via mixing toward white — works
    // even for very dark accents where a plain brightness multiply would
    // barely move) unless the user has manually picked their own color 2.
    // This keeps the default gradient reading as one cohesive accent rather
    // than two unrelated colors spread far apart.
    if (s.accentGradientEnabled && !s.accentGradientColor2Custom) {
      s.accentGradientColor2 = this._mix(brightAccent, '#ffffff', 0.35);
    }
    const color2 = s.accentGradientColor2 || '#ff8a65';
    // 3-stop gradient with a blended midpoint so the transition reads as a
    // smooth blend instead of two flat color blocks butted together.
    const midColor = this._mix(brightAccent, color2, 0.5);
    root.style.setProperty('--accent-bg', s.accentGradientEnabled
      ? 'linear-gradient(135deg, ' + brightAccent + ', ' + midColor + ', ' + color2 + ')'
      : brightAccent);

    const bs = document.getElementById('accent-brightness-slider');
    if (bs) bs.value = s.accentBrightness || 1;
    const bl = document.getElementById('accent-brightness-label');
    if (bl) bl.textContent = Math.round((s.accentBrightness || 1) * 100) + '%';
    const ao = document.getElementById('accent-outline-color');
    if (ao) ao.value = s.accentOutlineColor || brightAccent;
    const agt = document.getElementById('accent-gradient-toggle');
    if (agt) agt.checked = !!s.accentGradientEnabled;
    const ag2 = document.getElementById('accent-gradient-color2');
    if (ag2) ag2.value = color2;
    const ag2Group = document.getElementById('accent-gradient-color2-group');
    if (ag2Group) ag2Group.classList.toggle('hidden', !s.accentGradientEnabled);
  },

  _customThemeVars: [
    '--bg-primary', '--bg-secondary', '--bg-tertiary', '--bg-elevated', '--bg-hover', '--bg-active',
    '--border', '--border-light', '--border-glow',
    '--text-primary', '--text-secondary', '--text-dim', '--text-accent',
    '--gradient-1', '--gradient-2', '--gradient-3', '--gradient-4',
    '--titlebar-bg', '--panel-glass', '--scrollbar', '--scrollbar-hover'
  ],

  applyCustomTheme() {
    const s = this.settings;
    const body = document.body;
    const gradBg = document.getElementById('gradient-bg');

    if (s.theme !== 'theme-custom') {
      // Clear any inline overrides so regular themes render untouched
      this._customThemeVars.forEach(v => body.style.removeProperty(v));
      if (gradBg) gradBg.style.removeProperty('background');
      return;
    }

    const ct = s.customTheme || {};
    const mode = ct.mode || 'gradient';
    const c1 = ct.color1 || '#0a0a14';
    const c2 = mode === 'gradient' ? (ct.color2 || '#1a1a3e') : c1;
    const angle = ct.angle !== undefined ? ct.angle : 135;
    const spread = ct.spread !== undefined ? ct.spread : 100;
    const accent = ct.accent || '#4fc3f7';
    const isLight = this._isLightColor(c1);
    const dir = isLight ? -1 : 1; // lighten dark bases, darken light bases

    const set = (v, val) => body.style.setProperty(v, val);
    set('--bg-primary', c1);
    set('--bg-secondary', this._shade(c1, dir * 5));
    set('--bg-tertiary', this._shade(c1, dir * 10));
    set('--bg-elevated', this._shade(c1, dir * 16));
    set('--bg-hover', this._shade(c1, dir * 22));
    set('--bg-active', this._shade(c1, dir * 30));
    set('--border', isLight ? 'rgba(0,20,60,0.10)' : 'rgba(255,255,255,0.06)');
    set('--border-light', isLight ? 'rgba(0,20,60,0.15)' : 'rgba(255,255,255,0.10)');
    set('--border-glow', accent + '22');
    set('--text-primary', isLight ? '#1a2030' : '#e8e8f4');
    set('--text-secondary', isLight ? '#4a5568' : '#9090b0');
    set('--text-dim', isLight ? '#8090a8' : '#565678');
    set('--text-accent', accent);
    set('--gradient-1', c1);
    set('--gradient-2', this._mix(c1, c2, 0.33));
    set('--gradient-3', this._mix(c1, c2, 0.66));
    set('--gradient-4', c2);
    const c1rgb = this._hexToRgb(c1);
    if (c1rgb) {
      set('--titlebar-bg', 'rgba(' + c1rgb.r + ',' + c1rgb.g + ',' + c1rgb.b + ',0.97)');
      set('--panel-glass', 'rgba(' + c1rgb.r + ',' + c1rgb.g + ',' + c1rgb.b + ',0.55)');
    }
    set('--scrollbar', isLight ? 'rgba(0,20,60,0.12)' : 'rgba(255,255,255,0.08)');
    set('--scrollbar-hover', isLight ? 'rgba(0,20,60,0.20)' : 'rgba(255,255,255,0.15)');

    // Keep app accent in sync with the custom accent
    s.accent = accent;
    // Set accent vars directly so the fast path (applyCustomTheme only,
    // no full applySettings) still updates the whole UI while dragging
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-dim', accent + '22');
    root.style.setProperty('--accent-hover', accent + '44');
    root.style.setProperty('--accent-glow', accent + '28');

    // Direct gradient/solid background — angle sets the direction,
    // spread sets how far Color 1 blends before Color 2 takes over
    if (gradBg) {
      gradBg.style.background = mode === 'gradient'
        ? 'linear-gradient(' + angle + 'deg, ' + c1 + ' 0%, ' + this._mix(c1, c2, 0.5) + ' ' + Math.round(spread / 2) + '%, ' + c2 + ' ' + spread + '%)'
        : c1;
    }

    // Live preview on the theme card
    const preview = document.getElementById('custom-theme-preview');
    if (preview) {
      preview.style.background = mode === 'gradient'
        ? 'linear-gradient(' + angle + 'deg, ' + c1 + ' 0%, ' + c2 + ' ' + spread + '%)'
        : c1;
    }
  },

  // ── Custom Theme import/export (share a built theme between installs) ──
  async exportCustomTheme() {
    const ct = this.settings.customTheme || {};
    const payload = {
      xoNoteTheme: true,
      version: 1,
      customTheme: {
        mode: ct.mode || 'gradient',
        color1: ct.color1 || '#0a0a14',
        color2: ct.color2 || '#1a1a3e',
        angle: ct.angle !== undefined ? ct.angle : 135,
        spread: ct.spread !== undefined ? ct.spread : 100,
        accent: ct.accent || '#4fc3f7'
      }
    };
    try {
      const ok = await window.xo.exportThemeFile(JSON.stringify(payload, null, 2));
      this.updateStatusMessage(ok ? 'Theme exported' : 'Export cancelled');
    } catch (e) { this.updateStatusMessage('Export failed'); }
  },

  async importCustomTheme() {
    try {
      const raw = await window.xo.importThemeFile();
      if (!raw) return; // cancelled
      const parsed = JSON.parse(raw);
      const ct = parsed && parsed.customTheme ? parsed.customTheme : parsed;
      if (!ct || typeof ct !== 'object' || !ct.color1) {
        this.updateStatusMessage('That file doesn\'t look like a valid XO NOTE+ theme');
        return;
      }
      this.settings.customTheme = {
        mode: ct.mode === 'solid' ? 'solid' : 'gradient',
        color1: /^#[0-9a-fA-F]{6}$/.test(ct.color1) ? ct.color1 : '#0a0a14',
        color2: /^#[0-9a-fA-F]{6}$/.test(ct.color2) ? ct.color2 : '#1a1a3e',
        angle: (typeof ct.angle === 'number') ? ct.angle : 135,
        spread: (typeof ct.spread === 'number') ? ct.spread : 100,
        accent: /^#[0-9a-fA-F]{6}$/.test(ct.accent) ? ct.accent : '#4fc3f7'
      };
      this.settings.theme = 'theme-custom'; // switch to Custom so the import is visible right away
      this.saveSettings();
      this.applySettings();
      this.updateStatusMessage('Theme imported');
    } catch (e) {
      this.updateStatusMessage('Import failed — file may be corrupted');
    }
  },

  // ── Font hover previews (Settings > Fonts) ──
  // Native <select> dropdowns can't fire hover events per-option, so these
  // three selects get a lightweight custom dropdown built from their
  // existing <option> list (single source of truth, no markup duplication)
  // — clicking an option still just sets .value and dispatches a normal
  // 'change' event, so all existing settings-save logic keeps working
  // untouched. Hovering an option shows a live sample near the cursor.
  initFontSelectPreviews() {
    [
      { id: 'editor-font-select', kind: 'editor', axis: 'font' },
      { id: 'ui-font-select', kind: 'ui', axis: 'font' },
      { id: 'ui-font-weight', kind: 'ui', axis: 'weight' }
    ].forEach(cfg => this._enhanceFontSelect(cfg));
  },

  _enhanceFontSelect(cfg) {
    const select = document.getElementById(cfg.id);
    if (!select || select.dataset.enhanced) return;
    select.dataset.enhanced = '1';

    const wrap = document.createElement('div');
    wrap.className = 'font-select-wrap';
    select.parentNode.insertBefore(wrap, select);
    wrap.appendChild(select);
    select.classList.add('font-select-native-hidden');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'font-select-trigger';
    const selectedOpt = select.options[select.selectedIndex];
    trigger.innerHTML = '<span class="font-select-value"></span><span class="font-select-arrow">▾</span>';
    trigger.querySelector('.font-select-value').textContent = selectedOpt ? selectedOpt.textContent : '';
    wrap.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'font-select-menu hidden';
    Array.from(select.options).forEach(opt => {
      const row = document.createElement('div');
      row.className = 'font-select-option' + (opt.value === select.value ? ' active' : '');
      row.textContent = opt.textContent;
      row.addEventListener('click', () => {
        select.value = opt.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
        trigger.querySelector('.font-select-value').textContent = opt.textContent;
        menu.querySelectorAll('.font-select-option').forEach(r => r.classList.remove('active'));
        row.classList.add('active');
        menu.classList.add('hidden');
      });
      row.addEventListener('mouseenter', () => this._showFontHoverPreview(row, opt.value, cfg));
      row.addEventListener('mouseleave', () => this._hideFontHoverPreview());
      menu.appendChild(row);
    });
    wrap.appendChild(menu);

    trigger.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.font-select-menu').forEach(m => { if (m !== menu) m.classList.add('hidden'); });
      menu.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (!wrap.contains(e.target)) menu.classList.add('hidden');
    });
  },

  _showFontHoverPreview(anchorEl, value, cfg) {
    let tip = document.getElementById('font-hover-preview');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'font-hover-preview';
      tip.className = 'font-hover-preview';
      document.body.appendChild(tip);
    }
    tip.textContent = cfg.kind === 'editor'
      ? 'The quick brown fox jumps. 0123456789'
      : 'Folder Name / File Name.md';
    if (cfg.axis === 'weight') {
      tip.style.fontWeight = value;
      tip.style.fontFamily = cfg.kind === 'editor' ? this.settings.editorFont : this.settings.uiFont;
    } else {
      tip.style.fontFamily = value;
      tip.style.fontWeight = cfg.kind === 'editor' ? '400' : this.settings.uiFontWeight;
    }
    const rect = anchorEl.getBoundingClientRect();
    tip.classList.remove('hidden');
    const tipWidth = tip.offsetWidth || 240;
    const spaceRight = window.innerWidth - rect.right;
    if (spaceRight > tipWidth + 20) {
      tip.style.left = (rect.right + 10) + 'px';
    } else {
      tip.style.left = Math.max(10, rect.left - tipWidth - 10) + 'px';
    }
    tip.style.top = rect.top + 'px';
  },

  _hideFontHoverPreview() {
    const tip = document.getElementById('font-hover-preview');
    if (tip) tip.classList.add('hidden');
  },

  updateFontPreview() {
    const uiP = document.getElementById('font-preview-ui');
    const edP = document.getElementById('font-preview-editor');
    if (uiP) { uiP.style.fontFamily = this.settings.uiFont; uiP.style.fontWeight = this.settings.uiFontWeight; }
    if (edP) { edP.style.fontFamily = this.settings.editorFont; }
  },

  // ── Daily Motivational Quote (replaces the unused Tags panel) ──
  _dateKey(d) {
    return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate();
  },

  getDailyQuote() {
    const list = (typeof MOTIVATIONAL_QUOTES !== 'undefined' && MOTIVATIONAL_QUOTES.length) ? MOTIVATIONAL_QUOTES : [];
    if (!list.length) return null;
    // Deterministic by calendar day so it's stable all day and rotates at
    // midnight, rather than picking a new random quote on every reload.
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - start) / 86400000);
    return list[dayOfYear % list.length];
  },

  renderDailyQuote() {
    const container = document.getElementById('daily-quote');
    if (!container) return;
    const quote = this.getDailyQuote();
    if (!quote) {
      container.innerHTML = '<p class="sidebar-empty">No quotes available</p>';
      return;
    }
    container.innerHTML = '<p class="quote-text"></p><p class="quote-author"></p>';
    container.querySelector('.quote-text').textContent = '“' + quote.text + '”';
    container.querySelector('.quote-author').textContent = '— ' + quote.author;
    this._lastQuoteDateKey = this._dateKey(new Date());
  },

  startDailyQuoteRotation() {
    this.renderDailyQuote();
    // Check once a minute for the date rolling over past midnight and
    // re-render with the new day's quote when it does.
    setInterval(() => {
      const key = this._dateKey(new Date());
      if (key !== this._lastQuoteDateKey) this.renderDailyQuote();
    }, 60000);
  },

  // ── Changelog ──
  async initChangelog() {
    const list = (typeof CHANGELOG !== 'undefined' && CHANGELOG.length) ? CHANGELOG : [];
    let version = '';
    try { version = (await window.xo.getAppVersion()) || ''; } catch (e) { }
    if (!version) version = list.length ? list[0].version : '';
    this.appVersion = version;

    const label = document.getElementById('changelog-version-label');
    if (label) label.textContent = version ? 'v' + version : 'Changelog';

    this.renderChangelogPanel(list);

    // Show an unread dot if the newest entry hasn't been opened yet
    const dot = document.getElementById('changelog-dot');
    if (dot && list.length) {
      const lastSeen = (await this._loadLastSeenChangelog());
      dot.classList.toggle('hidden', lastSeen === list[0].version);
    }
  },

  async _loadLastSeenChangelog() {
    try {
      const config = await window.xo.loadConfig();
      return config.lastSeenChangelogVersion || null;
    } catch (e) { return null; }
  },

  renderChangelogPanel(list) {
    const body = document.getElementById('changelog-panel-body');
    if (!body) return;
    const entries = list || (typeof CHANGELOG !== 'undefined' ? CHANGELOG : []);
    if (!entries.length) {
      body.innerHTML = '<p class="sidebar-empty">No changelog yet</p>';
      return;
    }
    body.innerHTML = entries.map((entry, i) => {
      const badge = i === 0 ? '<span class="changelog-entry-badge">Latest</span>' : '';
      const items = (entry.changes || []).map(c => '<li></li>').join('');
      return '<div class="changelog-entry">' +
        '<div class="changelog-entry-header">' +
          '<span class="changelog-entry-version">v' + entry.version + '</span>' +
          '<span class="changelog-entry-date">' + (entry.date || '') + '</span>' +
          badge +
        '</div>' +
        '<ul>' + items + '</ul>' +
      '</div>';
    }).join('');
    // Fill list items via textContent to avoid any HTML-escaping issues with change text
    const allLis = body.querySelectorAll('.changelog-entry ul li');
    const flatChanges = entries.flatMap(e => e.changes || []);
    allLis.forEach((li, idx) => { li.textContent = flatChanges[idx] || ''; });
  },

  toggleChangelogPanel() {
    const panel = document.getElementById('changelog-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) this.openChangelogPanel();
    else this.closeChangelogPanel();
  },

  async openChangelogPanel() {
    // Only one bottom-right popover open at a time
    this.closeCreatorsPanel();
    const panel = document.getElementById('changelog-panel');
    if (panel) panel.classList.remove('hidden');
    const dot = document.getElementById('changelog-dot');
    if (dot) dot.classList.add('hidden');
    const list = (typeof CHANGELOG !== 'undefined' && CHANGELOG.length) ? CHANGELOG : [];
    if (list.length) {
      try { await window.xo.saveConfig({ lastSeenChangelogVersion: list[0].version }); } catch (e) { }
    }
  },

  closeChangelogPanel() {
    const panel = document.getElementById('changelog-panel');
    if (panel) panel.classList.add('hidden');
  },

  // ── Creators panel (bottom-right, next to What's New) ──
  toggleCreatorsPanel() {
    const panel = document.getElementById('creators-panel');
    if (!panel) return;
    if (panel.classList.contains('hidden')) this.openCreatorsPanel();
    else this.closeCreatorsPanel();
  },

  openCreatorsPanel() {
    // Only one bottom-right popover open at a time
    this.closeChangelogPanel();
    const panel = document.getElementById('creators-panel');
    if (panel) panel.classList.remove('hidden');
  },

  closeCreatorsPanel() {
    const panel = document.getElementById('creators-panel');
    if (panel) panel.classList.add('hidden');
  },

  // ── Auto-update (bottom-right status button) ──
  initAutoUpdate() {
    this._updateState = 'up-to-date';
    this._availableUpdate = null;
    if (window.xo.onUpdateStatus) {
      window.xo.onUpdateStatus((data) => this._handleUpdateStatus(data));
    }
    if (window.xo.onManualDownloadProgress) {
      window.xo.onManualDownloadProgress((data) => this.updateUpdatePickerProgress(data.percent));
    }
    // Give the window a moment to settle before the first check (main
    // process also does its own check shortly after launch, gated on the
    // Auto Update setting — this just makes sure the renderer's label
    // reflects whatever main already knows).
    setTimeout(() => { try { window.xo.checkForUpdates && window.xo.checkForUpdates(); } catch (e) { } }, 4500);
  },

  _handleUpdateStatus(data) {
    const btn = document.getElementById('btn-update-status');
    const label = document.getElementById('update-status-label');
    if (!btn || !label) return;
    this._updateState = data.status;
    btn.classList.remove('update-ready', 'update-downloading');
    switch (data.status) {
      case 'checking':
        label.textContent = 'Checking for updates...';
        break;
      case 'available':
        this._availableUpdate = { version: data.version || '', notes: data.notes || '' };
        label.textContent = 'You Got an Update! Click to view';
        btn.classList.add('update-downloading');
        break;
      case 'downloading':
        label.textContent = (data.percent != null && data.percent > 0)
          ? 'Downloading update... ' + data.percent + '%'
          : 'Update found, downloading...';
        btn.classList.add('update-downloading');
        this.updateUpdatePickerProgress(data.percent);
        break;
      case 'ready':
        label.textContent = 'You Got an Update! Click to restart';
        btn.classList.add('update-ready');
        break;
      case 'up-to-date':
      default:
        label.textContent = "You're up to Date!";
        this._availableUpdate = null;
        break;
    }
  },

  // ── Report a Bug (bottom-right) ──
  async reportBug() {
    let version = this.appVersion || '';
    if (!version) {
      try { version = (await window.xo.getAppVersion()) || ''; } catch (e) { }
    }
    const title = encodeURIComponent('[Bug] ' + (version ? 'v' + version + ' — ' : ''));
    const url = 'https://github.com/Chaoz75/xo-note-plus/issues/new?title=' + title;
    try { await window.xo.openExternal(url); } catch (e) { }
  },

  async handleUpdateButtonClick() {
    if (this._updateState === 'ready') {
      try { await window.xo.quitAndInstall(); } catch (e) { }
    } else if (this._updateState === 'available') {
      this.openUpdatePicker();
    } else if (this._updateState !== 'checking' && this._updateState !== 'downloading') {
      try { await window.xo.checkForUpdates(); } catch (e) { }
    }
  },

  // ── Update picker modal (choose latest vs. any other version) ──
  openUpdatePicker() {
    const modal = document.getElementById('update-picker-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    this.showUpdatePickerChoiceView();
  },

  closeUpdatePicker() {
    const modal = document.getElementById('update-picker-modal');
    if (modal) modal.classList.add('hidden');
  },

  showUpdatePickerChoiceView() {
    const choiceView = document.getElementById('update-picker-choice-view');
    const listView = document.getElementById('update-picker-list-view');
    const progressView = document.getElementById('update-picker-progress-view');
    if (choiceView) choiceView.classList.remove('hidden');
    if (listView) listView.classList.add('hidden');
    if (progressView) progressView.classList.add('hidden');

    const update = this._availableUpdate || {};
    const verEl = document.getElementById('update-picker-latest-version');
    if (verEl) verEl.textContent = update.version ? ('v' + update.version) : '—';
    const notesEl = document.getElementById('update-picker-latest-notes');
    if (notesEl) notesEl.textContent = update.notes || '';
  },

  async showUpdatePickerListView() {
    const choiceView = document.getElementById('update-picker-choice-view');
    const listView = document.getElementById('update-picker-list-view');
    const progressView = document.getElementById('update-picker-progress-view');
    if (choiceView) choiceView.classList.add('hidden');
    if (listView) listView.classList.remove('hidden');
    if (progressView) progressView.classList.add('hidden');

    const listEl = document.getElementById('update-picker-version-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="sidebar-empty">Loading versions...</p>';
    try {
      const releases = (await window.xo.listReleases()) || [];
      if (!releases.length) {
        listEl.innerHTML = '<p class="sidebar-empty">No releases found.</p>';
        return;
      }
      listEl.innerHTML = '';
      releases.forEach((r) => {
        const isCurrent = !!this.appVersion && r.version === this.appVersion;
        const item = document.createElement('div');
        item.className = 'update-version-item';
        item.innerHTML =
          '<div class="update-version-item-header">' +
            '<span class="update-version-item-version"></span>' +
            '<span class="update-version-item-date"></span>' +
            (isCurrent ? '<span class="update-version-item-badge">Current</span>' : '') +
          '</div>' +
          '<div class="update-version-item-notes"></div>';
        item.querySelector('.update-version-item-version').textContent = 'v' + r.version;
        item.querySelector('.update-version-item-date').textContent = r.publishedAt ? new Date(r.publishedAt).toLocaleDateString() : '';
        item.querySelector('.update-version-item-notes').textContent = r.notes || '';
        if (!isCurrent) {
          const installBtn = document.createElement('button');
          installBtn.className = 'btn-sm btn-secondary';
          installBtn.textContent = 'Install this Version';
          installBtn.addEventListener('click', () => this.selectVersionToInstall(r));
          item.appendChild(installBtn);
        }
        listEl.appendChild(item);
      });
    } catch (e) {
      listEl.innerHTML = '<p class="sidebar-empty">Could not load release list.</p>';
    }
  },

  showUpdatePickerProgressView(labelText) {
    const choiceView = document.getElementById('update-picker-choice-view');
    const listView = document.getElementById('update-picker-list-view');
    const progressView = document.getElementById('update-picker-progress-view');
    if (choiceView) choiceView.classList.add('hidden');
    if (listView) listView.classList.add('hidden');
    if (progressView) progressView.classList.remove('hidden');
    const progLabel = document.getElementById('update-picker-progress-label');
    if (progLabel) progLabel.textContent = labelText || 'Downloading...';
    const fill = document.getElementById('update-picker-progress-fill');
    if (fill) fill.style.width = '0%';
  },

  updateUpdatePickerProgress(percent) {
    const modal = document.getElementById('update-picker-modal');
    if (!modal || modal.classList.contains('hidden')) return;
    const progressView = document.getElementById('update-picker-progress-view');
    if (!progressView || progressView.classList.contains('hidden')) return;
    if (percent == null) return;
    const fill = document.getElementById('update-picker-progress-fill');
    if (fill) fill.style.width = percent + '%';
    const progLabel = document.getElementById('update-picker-progress-label');
    if (progLabel) progLabel.textContent = 'Downloading update... ' + percent + '%';
  },

  async chooseUpdateToLatest() {
    this.showUpdatePickerProgressView('Downloading latest version...');
    try {
      await window.xo.startDownloadLatest();
      // The 'ready' status arrives via onUpdateStatus once the download
      // finishes — close the picker and let the bottom-right button
      // prompt the restart.
      this.closeUpdatePicker();
    } catch (e) {
      this.showUpdatePickerChoiceView();
    }
  },

  chooseOtherVersion() {
    this.showUpdatePickerListView();
  },

  async selectVersionToInstall(release) {
    this.showUpdatePickerProgressView('Downloading v' + release.version + '...');
    try {
      const filePath = await window.xo.downloadSpecificVersion(release.assetId, release.version);
      if (!filePath) {
        this.showUpdatePickerProgressView('Download failed. Please try again.');
        return;
      }
      this.showUpdatePickerProgressView('Installing v' + release.version + '...');
      await window.xo.installDownloadedFile(filePath);
    } catch (e) {
      this.showUpdatePickerProgressView('Download failed. Please try again.');
    }
  },

  // ── Dashboard ──
  showDashboard() {
    const dash = document.getElementById('home-dashboard');
    const editor = document.getElementById('editor-wrapper');
    const welcome = document.getElementById('welcome-screen');
    const breadcrumb = document.getElementById('breadcrumb');
    const tabBar = document.getElementById('tab-bar');
    if (dash) dash.classList.remove('hidden');
    if (editor) editor.classList.add('hidden');
    if (welcome) welcome.classList.add('hidden');
    // The path bar and open-tabs row only make sense when a note is open —
    // hide them on the home screen so they don't sit on top of "Welcome Back"
    if (breadcrumb) breadcrumb.classList.add('hidden');
    if (tabBar) tabBar.classList.add('hidden');
    this.updateWordCharCount('');

    this.updateDashboardDateTime();
    this.renderDashboardCalendar();
    this.renderDashboardClocks();
    this.renderStickyNotes();
    this.renderStickyTasks();

    if (this.dashboardInterval) clearInterval(this.dashboardInterval);
    this.dashboardInterval = setInterval(() => {
      this.updateDashboardDateTime();
      this.renderDashboardClocks();
    }, 1000);
  },

  hideDashboard() {
    const dash = document.getElementById('home-dashboard');
    const breadcrumb = document.getElementById('breadcrumb');
    const tabBar = document.getElementById('tab-bar');
    if (dash) dash.classList.add('hidden');
    if (breadcrumb) breadcrumb.classList.remove('hidden');
    if (tabBar) tabBar.classList.remove('hidden');
    if (this.dashboardInterval) { clearInterval(this.dashboardInterval); this.dashboardInterval = null; }
  },

  updateDashboardDateTime() {
    const now = new Date();
    const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = days[now.getDay()] + ', ' + months[now.getMonth()] + ' ' + now.getDate();

    let timeStr;
    if (this.settings.timeFormat === '24') {
      timeStr = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0');
    } else {
      let h = now.getHours();
      const ampm = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      timeStr = String(h) + ':' + String(now.getMinutes()).padStart(2,'0') + ' ' + ampm;
    }

    const dateEl = document.getElementById('dashboard-date');
    const timeEl = document.getElementById('dashboard-time');
    if (dateEl) dateEl.textContent = dateStr;
    if (timeEl) timeEl.textContent = timeStr;

    // Welcome message
    const welcomeEl = document.getElementById('dashboard-welcome');
    if (welcomeEl) {
      const userName = this.settings.userName || '';
      if (userName) {
        welcomeEl.innerHTML = 'Welcome Back, <strong>' + userName + '</strong>';
      } else {
        welcomeEl.innerHTML = 'Welcome Back';
      }
    }
  },

  renderDashboardCalendar() {
    const container = document.getElementById('dashboard-calendar');
    if (!container) return;
    this._renderCalendar(container, true);
  },

  renderDashboardClocks() {
    const container = document.getElementById('dashboard-clocks');
    if (!container) return;
    container.innerHTML = '';
    this.settings.clocks.forEach((clock, idx) => {
      const div = document.createElement('div');
      div.className = 'clock-widget';
      div.innerHTML = '<div class="clock-label">' + clock.label + '</div><div class="clock-time">' + this._getClockTime(clock.tz) + '</div>';

      // Add subtle remove button (only shows on hover)
      const removeBtn = document.createElement('button');
      removeBtn.className = 'clock-remove-btn';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.settings.clocks.splice(idx, 1);
        this.saveSettings();
        this.renderDashboardClocks();
      });
      div.appendChild(removeBtn);
      container.appendChild(div);
    });

    // Add timezone button (compact, at bottom)
    const addDiv = document.createElement('div');
    addDiv.className = 'clock-add-widget';
    addDiv.innerHTML = '<button class="clock-add-btn" id="btn-add-dashboard-clock" title="Add Timezone">+</button>';
    container.appendChild(addDiv);

    const addClockBtn = document.getElementById('btn-add-dashboard-clock');
    if (addClockBtn) {
      addClockBtn.addEventListener('click', () => this.addDashboardClock());
    }
  },

  renderMiniAnalogClock(canvas, tz) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const now = new Date();
    let hour = now.getHours();
    let minute = now.getMinutes();
    let second = now.getSeconds();

    if (tz !== 'local') {
      try {
        const tzDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
        hour = tzDate.getHours();
        minute = tzDate.getMinutes();
        second = tzDate.getSeconds();
      } catch (e) { }
    }

    const radius = canvas.width / 2;
    const centerX = radius;
    const centerY = radius;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Get computed accent color from CSS
    const accentColor = this.settings.accent || '#4fc3f7';
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || '#333';

    // Face
    ctx.fillStyle = 'transparent';
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Center circle
    ctx.fillStyle = accentColor;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 2, 0, Math.PI * 2);
    ctx.fill();

    // Hour hand
    const hourAngle = (hour % 12 + minute / 60) * (Math.PI / 6) - Math.PI / 2;
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(hourAngle) * (radius * 0.5), centerY + Math.sin(hourAngle) * (radius * 0.5));
    ctx.stroke();

    // Minute hand
    const minuteAngle = (minute + second / 60) * (Math.PI / 30) - Math.PI / 2;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(centerX + Math.cos(minuteAngle) * (radius * 0.7), centerY + Math.sin(minuteAngle) * (radius * 0.7));
    ctx.stroke();
  },

  addDashboardClock() {
    const timezones = [
      { label: 'UTC', tz: 'UTC' },
      { label: 'GMT', tz: 'Europe/London' },
      { label: 'CET', tz: 'Europe/Paris' },
      { label: 'IST', tz: 'Asia/Kolkata' },
      { label: 'CST', tz: 'Asia/Shanghai' },
      { label: 'JST', tz: 'Asia/Tokyo' },
      { label: 'AEST', tz: 'Australia/Sydney' },
      { label: 'EST', tz: 'America/New_York' },
      { label: 'CST', tz: 'America/Chicago' },
      { label: 'MST', tz: 'America/Denver' },
      { label: 'PST', tz: 'America/Los_Angeles' }
    ];

    const menu = document.createElement('div');
    menu.id = 'timezone-picker-menu';
    menu.className = 'context-menu';
    menu.style.left = '50%';
    menu.style.top = '50%';
    menu.style.transform = 'translate(-50%, -50%)';

    menu.innerHTML = '<div style="max-height:300px;overflow-y:auto;padding:8px;">' +
      timezones.map(tz => '<div class="tz-option" data-tz="' + tz.tz + '" data-label="' + tz.label + '" style="padding:10px;cursor:pointer;border-radius:6px;transition:all 0.15s;" onmouseover="this.style.background=\'var(--accent-dim)\'" onmouseout="this.style.background=\'\';">' + tz.label + ' (' + tz.tz + ')</div>').join('') +
      '</div>';

    document.body.appendChild(menu);

    menu.querySelectorAll('.tz-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const tz = opt.dataset.tz;
        const label = opt.dataset.label;
        this.settings.clocks.push({ label: label, tz: tz });
        this.saveSettings();
        this.renderDashboardClocks();
        menu.remove();
      });
    });

    const closeHandler = (ev) => { if (!ev.target.closest('#timezone-picker-menu')) { menu.remove(); document.removeEventListener('click', closeHandler); } };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  _getClockTime(tz) {
    const now = new Date();
    const hour12 = this.settings.timeFormat !== '24';
    if (tz === 'local') {
      return now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: hour12 });
    }
    try {
      return now.toLocaleTimeString('en-US', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: hour12 });
    } catch (e) { return '--:--'; }
  },

  // ── Calendar (shared renderer) ──
  _getCalendarFilePath(year, month, day) {
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
    return this.vaultPath + '/Calendar/' + year + '/' + monthNames[month] + '/' + dateStr + '.md';
  },

  async _renderCalendar(container, interactive) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const today = now.getDate();
    const monthNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    // Check which days have files (for dot indicators)
    const daysWithFiles = {};
    if (this.vaultPath && interactive) {
      for (let d = 1; d <= daysInMonth; d++) {
        const filePath = this._getCalendarFilePath(year, month, d);
        try {
          const exists = await window.xo.fileExists(filePath);
          if (exists) daysWithFiles[d] = true;
        } catch (e) { }
        // Also check legacy Journal/ folder
        if (!daysWithFiles[d]) {
          const dateStr = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
          try {
            const exists = await window.xo.fileExists(this.vaultPath + '/Journal/' + dateStr + '.md');
            if (exists) daysWithFiles[d] = true;
          } catch (e) { }
        }
      }
    }

    let html = '<div class="cal-header"><span class="cal-title">' + monthNames[month] + ' ' + year + '</span></div>';
    html += '<div class="cal-days-header">' + dayNames.map(d => '<span class="cal-day-label">' + d + '</span>').join('') + '</div>';
    html += '<div class="cal-grid">';

    for (let i = firstDay - 1; i >= 0; i--) {
      html += '<span class="cal-day other-month">' + (daysInPrev - i) + '</span>';
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const isToday = d === today ? ' today' : '';
      const inter = interactive ? ' interactive' : '';
      const hasNotes = daysWithFiles[d] ? ' has-notes' : '';
      const dotKey = year + '-' + String(month + 1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
      const dotColor = this.calendarDotColors[dotKey] || '';
      const hasCustom = dotColor ? ' has-custom-color' : '';
      const dotStyle = dotColor ? ' style="--dot-color:' + dotColor + ';"' : '';
      html += '<span class="cal-day' + isToday + inter + hasNotes + hasCustom + '"' + dotStyle + ' data-day="' + d + '" data-month="' + month + '" data-year="' + year + '">' + d + '</span>';
    }
    const totalCells = firstDay + daysInMonth;
    const remaining = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      html += '<span class="cal-day other-month">' + i + '</span>';
    }
    html += '</div>';
    container.innerHTML = html;

    if (interactive && this.vaultPath) {
      for (const el of container.querySelectorAll('.cal-day:not(.other-month)')) {
        // Single click opens existing file
        el.addEventListener('click', async () => {
          const day = parseInt(el.dataset.day);
          const m = parseInt(el.dataset.month);
          const y = parseInt(el.dataset.year);
          const filePath = this._getCalendarFilePath(y, m, day);
          const dateStr = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
          // Check new path first, then legacy
          let exists = await window.xo.fileExists(filePath);
          if (exists) {
            this.openFile(filePath, dateStr + '.md');
          } else {
            const legacyPath = this.vaultPath + '/Journal/' + dateStr + '.md';
            exists = await window.xo.fileExists(legacyPath);
            if (exists) {
              this.openFile(legacyPath, dateStr + '.md');
            } else {
              this.updateStatusMessage('No entry for ' + dateStr + ' — double-click to create');
            }
          }
        });

        // Double click creates new file with auto-foldering
        el.addEventListener('dblclick', async () => {
          const day = parseInt(el.dataset.day);
          const m = parseInt(el.dataset.month);
          const y = parseInt(el.dataset.year);
          const filePath = this._getCalendarFilePath(y, m, day);
          const dateStr = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
          const mNames = ['January','February','March','April','May','June','July','August','September','October','November','December'];
          const exists = await window.xo.fileExists(filePath);
          if (!exists) {
            // Ensure Calendar/YYYY/MonthName/ folder structure
            await window.xo.ensureDirectory(this.vaultPath + '/Calendar');
            await window.xo.ensureDirectory(this.vaultPath + '/Calendar/' + y);
            await window.xo.ensureDirectory(this.vaultPath + '/Calendar/' + y + '/' + mNames[m]);
            const dayNum = parseInt(String(day));
            const suffix = (dayNum === 1 || dayNum === 21 || dayNum === 31) ? 'st' : (dayNum === 2 || dayNum === 22) ? 'nd' : (dayNum === 3 || dayNum === 23) ? 'rd' : 'th';
            const dayOfWeekNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
            const entryDate = new Date(y, m, dayNum);
            const dayOfWeek = dayOfWeekNames[entryDate.getDay()];
            const writtenDate = dayOfWeek + ', ' + mNames[m] + ' ' + dayNum + suffix + ' ' + y;
            await window.xo.writeFile(filePath, '# ' + dateStr + '\n# ' + writtenDate + '\n\n');
            el.classList.add('has-notes');
            await this.loadFileTree();
            // Refresh both calendars so dots update immediately
            this.renderWidgetCalendar();
          }
          this.openFile(filePath, dateStr + '.md');
        });

        // Right-click to change dot color
        el.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const day = parseInt(el.dataset.day);
          const m = parseInt(el.dataset.month);
          const y = parseInt(el.dataset.year);
          const key = y + '-' + String(m + 1).padStart(2,'0') + '-' + String(day).padStart(2,'0');
          const existing = document.getElementById('cal-color-menu');
          if (existing) existing.remove();
          const menu = document.createElement('div');
          menu.id = 'cal-color-menu';
          menu.className = 'context-menu';
          menu.style.left = e.clientX + 'px';
          menu.style.top = e.clientY + 'px';
          const colors = ['#ef5350', '#ff9800', '#fff176', '#81c784', '#4fc3f7', '#ce93d8', ''];
          menu.innerHTML = '<div style="padding:8px;display:flex;gap:4px;">' + colors.map(c =>
            '<span class="color-dot" data-color="' + c + '" style="width:16px;height:16px;border-radius:50%;cursor:pointer;display:inline-block;background:' + (c || '#555') + ';border:1px solid rgba(255,255,255,0.2);' + (c === '' ? 'position:relative;' : '') + '">' + (c === '' ? '<span style="position:absolute;top:0;left:3px;font-size:10px;">✕</span>' : '') + '</span>'
          ).join('') + '</div>';
          document.body.appendChild(menu);
          menu.querySelectorAll('.color-dot').forEach(dot => {
            dot.addEventListener('click', () => {
              const color = dot.dataset.color;
              if (color) { this.calendarDotColors[key] = color; } else { delete this.calendarDotColors[key]; }
              this.saveSettings();
              el.style.setProperty('--dot-color', color || '');
              if (color) { el.classList.add('has-custom-color'); } else { el.classList.remove('has-custom-color'); }
              menu.remove();
            });
          });
          const closeHandler = (ev) => { if (!ev.target.closest('#cal-color-menu')) { menu.remove(); document.removeEventListener('click', closeHandler); } };
          setTimeout(() => document.addEventListener('click', closeHandler), 10);
        });
      }
    }
  },

  renderWidgetCalendar() {
    const container = document.getElementById('widget-calendar');
    if (!container) return;
    this._renderCalendar(container, true);
  },

  renderFileTree(entries, container, depth = 0) {
    const tree = container || document.getElementById('file-tree');
    if (!container) tree.innerHTML = '';
    let items = entries || this.fileTree;

    // Sort items: pinned first, then by sortOrder, then by name
    items = items.sort((a, b) => {
      const aPinned = this.pinnedFolders.includes(a.path) ? 0 : 1;
      const bPinned = this.pinnedFolders.includes(b.path) ? 0 : 1;
      if (aPinned !== bPinned) return aPinned - bPinned;
      const aSort = this.sortOrder[a.path] !== undefined ? this.sortOrder[a.path] : 999;
      const bSort = this.sortOrder[b.path] !== undefined ? this.sortOrder[b.path] : 999;
      if (aSort !== bSort) return aSort - bSort;
      return a.name.localeCompare(b.name);
    });

    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'tree-item';
      div.setAttribute('data-path', item.path);
      div.setAttribute('data-is-dir', item.isDirectory);
      div.setAttribute('draggable', 'true');
      div.style.paddingLeft = (12 + depth * 16) + 'px';

      // Block size
      if (this.blockSizes[item.path]) {
        div.classList.add('size-' + this.blockSizes[item.path]);
      }

      // Color tag style: get per-path style or default to minimal
      const tagStyle = this.colorTagStyles[item.path] || 'minimal';

      // Color tag: block mode
      if (this.colorTags[item.path] && tagStyle === 'block') {
        const cn = this.getColorClassName(this.colorTags[item.path]);
        if (cn) div.classList.add('color-block-' + cn);
      }

      // Color tag: minimal mode (thin bar)
      if (this.colorTags[item.path] && tagStyle === 'minimal') {
        const tag = document.createElement('div');
        tag.className = 'tree-color-tag';
        tag.style.background = this.colorTags[item.path];
        div.appendChild(tag);
      }

      if (item.isDirectory) {
        const chevron = document.createElement('span');
        chevron.className = 'tree-chevron';
        chevron.textContent = '▸';
        div.appendChild(chevron);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'tree-icon';
        iconSpan.innerHTML = this.customIcons[item.path]
          ? this.getCustomIconSVG(this.customIcons[item.path])
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>';
        div.appendChild(iconSpan);

        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-name';
        nameSpan.textContent = item.name;
        div.appendChild(nameSpan);

        if (this.starred.includes(item.path)) {
          const star = document.createElement('span');
          star.className = 'star-icon';
          star.textContent = '★';
          div.appendChild(star);
        }

        if (this.pinnedFolders.includes(item.path)) {
          const pin = document.createElement('span');
          pin.className = 'pin-icon';
          pin.textContent = '📌';
          div.appendChild(pin);
        }

        const childContainer = document.createElement('div');
        childContainer.className = 'tree-folder-children collapsed';
        childContainer.setAttribute('data-path', item.path);

        div.addEventListener('click', async (e) => {
          e.stopPropagation();
          const expanded = chevron.classList.contains('expanded');
          chevron.classList.toggle('expanded');
          childContainer.classList.toggle('collapsed');
          if (!expanded && childContainer.children.length === 0) {
            const children = await this.loadFileTree(item.path);
            if (children) this.renderFileTree(children, childContainer, depth + 1);
          }
        });

        tree.appendChild(div);
        tree.appendChild(childContainer);
      } else {
        const ext = item.ext || '';
        const iconSpan = document.createElement('span');
        iconSpan.className = 'tree-icon';
        if (this.customIcons[item.path]) {
          iconSpan.innerHTML = this.getCustomIconSVG(this.customIcons[item.path]);
        } else {
          iconSpan.innerHTML = (ext === '.md' || ext === '.txt')
            ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>'
            : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path></svg>';
        }
        div.appendChild(iconSpan);

        const displayName = this.settings.showExtensions ? item.name : item.name.replace(/\.[^.]+$/, '');
        const nameSpan = document.createElement('span');
        nameSpan.className = 'tree-name';
        nameSpan.textContent = displayName;
        div.appendChild(nameSpan);

        if (this.starred.includes(item.path)) {
          const star = document.createElement('span');
          star.className = 'star-icon';
          star.textContent = '★';
          div.appendChild(star);
        }

        div.addEventListener('click', (e) => { e.stopPropagation(); this.openFile(item.path, item.name); });
        div.addEventListener('dblclick', (e) => { e.stopPropagation(); this.startRenameInline(div, item); });
        tree.appendChild(div);
      }

      // Context menu
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault(); e.stopPropagation();
        this.contextMenuVisible = true;
        this.showContextMenu(e.clientX, e.clientY, item);
      });

      // Drag & drop for reordering and moving
      div.addEventListener('dragstart', (e) => {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.path);
        div.classList.add('dragging');
      });
      div.addEventListener('dragend', () => {
        div.classList.remove('dragging');
        document.querySelectorAll('.drag-over, .drag-above, .drag-below').forEach(el => el.classList.remove('drag-over', 'drag-above', 'drag-below'));
        document.querySelectorAll('.drag-root-target').forEach(el => el.classList.remove('drag-root-target'));
      });

      // All items can be drop targets for reordering — or, if the OS drag
      // carries real files (e.g. dragged in from Windows Explorer), for
      // importing those files into the vault.
      div.addEventListener('dragover', (e) => {
        e.preventDefault();
        const isOsFileDrag = e.dataTransfer.types.includes('Files');
        e.dataTransfer.dropEffect = isOsFileDrag ? 'copy' : 'move';
        const rect = div.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        div.classList.remove('drag-above', 'drag-below', 'drag-over');
        if (isOsFileDrag) {
          // Importing: highlight the row only when it can receive the drop (a folder)
          if (item.isDirectory) div.classList.add('drag-over');
          return;
        }
        if (item.isDirectory && e.clientY > rect.top + rect.height * 0.25 && e.clientY < rect.top + rect.height * 0.75) {
          div.classList.add('drag-over'); // Drop INTO folder
        } else if (e.clientY < midY) {
          div.classList.add('drag-above'); // Reorder above
        } else {
          div.classList.add('drag-below'); // Reorder below
        }
      });
      div.addEventListener('dragleave', () => div.classList.remove('drag-over', 'drag-above', 'drag-below'));
      div.addEventListener('drop', async (e) => {
        e.preventDefault();
        div.classList.remove('drag-over', 'drag-above', 'drag-below');

        // OS files dropped on/near this row: import them instead of reordering.
        // Don't stopPropagation — nothing else needs this event, and letting
        // it bubble keeps the tree-level handler as a harmless no-op fallback.
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const destDir = item.isDirectory ? item.path : await window.xo.dirname(item.path);
          for (const file of e.dataTransfer.files) {
            if (file.path) await window.xo.copyExternalItem(file.path, destDir);
          }
          this.updateStatusMessage('Files imported');
          await this.loadFileTree();
          this.renderSpaces();
          return;
        }

        e.stopPropagation();
        const srcPath = e.dataTransfer.getData('text/plain');
        const isDragOver = div.classList.contains('drag-over');
        div.classList.remove('drag-over', 'drag-above', 'drag-below');
        if (!srcPath || srcPath === item.path) return;

        if (isDragOver && item.isDirectory) {
          // Move INTO folder
          await window.xo.moveItem(srcPath, item.path);
          this.updateStatusMessage('Moved into ' + item.name);
        } else {
          // Reorder: rebuild sort orders as clean integers
          const allItems = tree.querySelectorAll(':scope > .tree-item');
          const orderedPaths = [];
          allItems.forEach(el => { if (el.dataset.path) orderedPaths.push(el.dataset.path); });
          // Remove the source from the list
          const srcIdx = orderedPaths.indexOf(srcPath);
          if (srcIdx >= 0) orderedPaths.splice(srcIdx, 1);
          // Find where to insert
          const targetIdx = orderedPaths.indexOf(item.path);
          const rect = div.getBoundingClientRect();
          const midY = rect.top + rect.height / 2;
          if (targetIdx >= 0) {
            if (e.clientY < midY) {
              orderedPaths.splice(targetIdx, 0, srcPath);
            } else {
              orderedPaths.splice(targetIdx + 1, 0, srcPath);
            }
          } else {
            orderedPaths.push(srcPath);
          }
          // Assign clean integer sort orders
          orderedPaths.forEach((p, i) => { this.sortOrder[p] = i; });
          this.saveSettings();
        }
        await this.loadFileTree();
        this.renderSpaces();
      });
    }

    // Allow dropping on file-tree root area to move items back to vault root
    if (!container) {
      tree.addEventListener('dragover', (e) => {
        // Only respond when not over a tree-item
        if (e.target === tree || e.target.classList.contains('file-tree')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          tree.classList.add('drag-root-target');
        }
      });
      tree.addEventListener('dragleave', (e) => {
        if (e.target === tree) tree.classList.remove('drag-root-target');
      });
      tree.addEventListener('drop', async (e) => {
        if (e.target !== tree && !e.target.classList.contains('file-tree')) return;
        e.preventDefault();
        tree.classList.remove('drag-root-target');
        const srcPath = e.dataTransfer.getData('text/plain');
        if (srcPath) {
          // Move to vault root
          await window.xo.moveItem(srcPath, this.vaultPath);
          this.updateStatusMessage('Moved to vault root');
          await this.loadFileTree();
          this.renderSpaces();
        }
      });
    }

    // Re-highlight the active file after tree rebuild
    if (!container && this.activeTabIndex >= 0 && this.openTabs[this.activeTabIndex]) {
      this.highlightActiveTreeItem(this.openTabs[this.activeTabIndex].path);
    }
  },

  getColorClassName(hex) {
    const map = { '#ef5350': 'red', '#ff9800': 'orange', '#fff176': 'yellow', '#81c784': 'green', '#4fc3f7': 'blue', '#ce93d8': 'purple' };
    return map[hex] || '';
  },

  getCustomIconSVG(iconName) {
    const icons = {
      file: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>',
      folder: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>',
      star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 10.26 24 10.27 17.18 16.63 20.27 24.9 12 18.54 3.73 24.9 6.82 16.63 0 10.27 8.91 10.26 12 2"></polygon></svg>',
      dollar: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
      heart: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>',
      flag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>',
      bookmark: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>',
      lightning: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
      music: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>',
      rocket: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4.5 16.5c-1.5-1.5-2-3.5-2-5.5 0-4 3-8 8-8s8 4 8 8-3 7-8 8c-2 0-4-.5-5.5-2"></path><path d="M12 8v8M8 12h8"></path></svg>',
      check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>',
      alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3.05h16.94a2 2 0 0 0 1.71-3.05L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>'
    };
    return icons[iconName] || icons.file;
  },

  renderWorkspaces() {
    const container = document.getElementById('workspaces');
    if (!container) return;
    container.innerHTML = '';
    this.fileTree.forEach(item => {
      const div = document.createElement('div');
      div.className = 'workspace-item';
      div.innerHTML = '<span class="workspace-name">' + item.name + '</span>';
      div.addEventListener('click', () => this.currentFolderPath = item.path);
      container.appendChild(div);
    });
  },

  goBackFolder() {
    if (this.folderHistory.length > 0) {
      this.currentFolderPath = this.folderHistory.pop();
      this.updateBackButtonVisibility();
    }
  },

  async loadFileTree(path = null) {
    try {
      const data = await window.xo.readDirectory(path || this.vaultPath);
      if (path) return data;
      this.fileTree = data || [];
      this.renderFileTree();
      this.renderSpaces();
    } catch (e) { console.error('Load file tree error:', e); }
  },

  updateBackButtonVisibility() {
    const btn = document.getElementById('btn-back-folder');
    if (btn) btn.style.display = this.folderHistory.length > 0 ? 'block' : 'none';
  },

  // ── Editor ──
  showEditor(tab) {
    const editor = document.getElementById('editor-wrapper');
    if (editor) editor.classList.remove('hidden');
    this.hideDashboard();
    if (this.editorMode === 'visual') {
      this.showVisualEditor(tab);
    } else {
      this.showMarkdownEditor(tab);
    }
  },

  showVisualEditor(tab) {
    const rich = document.getElementById('editor-rich');
    const textarea = document.getElementById('editor-textarea');
    rich.classList.remove('hidden');
    textarea.classList.add('hidden');
    const html = MarkdownParser.parse(tab.content);
    rich.innerHTML = html || '<p><br></p>';
    this.updateWordCharCount(tab.content);
    this.processCodeBlocks();
    this.processTables();
    // Make checkboxes interactive and trigger save
    rich.querySelectorAll('input[type="checkbox"]').forEach(cb => {
      cb.removeAttribute('disabled');
      cb.addEventListener('change', () => this.onRichEditorChange());
    });
    // Restore code block states (collapse + label size)
    if (tab.codeBlockStates) {
      const wrappers = rich.querySelectorAll('.code-block-wrapper');
      Object.entries(tab.codeBlockStates).forEach(([idx, stateData]) => {
        const wrapper = wrappers[parseInt(idx)];
        if (!wrapper) return;
        // Handle both old string format and new object format
        const collapseState = typeof stateData === 'string' ? stateData : (stateData.collapse || 'preview');
        const labelSize = typeof stateData === 'object' ? (stateData.labelSize || '') : '';
        const btn = wrapper.querySelector('.code-block-collapse-btn');
        if (collapseState === 'collapsed') {
          wrapper.classList.add('code-collapsed');
          wrapper.classList.remove('code-preview');
          if (btn) btn.textContent = '+';
        } else if (collapseState === 'preview') {
          wrapper.classList.add('code-preview');
          wrapper.classList.remove('code-collapsed');
          if (btn) btn.textContent = '◑';
        } else {
          wrapper.classList.remove('code-collapsed', 'code-preview');
          if (btn) btn.textContent = '−';
        }
        // Restore label size
        if (labelSize) {
          const label = wrapper.querySelector('.code-block-label');
          const header = wrapper.querySelector('.code-block-header');
          if (label) label.style.fontSize = labelSize;
          if (header) header.style.fontSize = labelSize;
        }
      });
    }
    // Ensure there's always a trailing paragraph for typing at the end
    const lastEl = rich.lastElementChild;
    if (lastEl && (lastEl.classList.contains('code-block-wrapper') || lastEl.classList.contains('table-wrapper') || lastEl.tagName === 'PRE' || lastEl.tagName === 'TABLE')) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      rich.appendChild(p);
    }

    // Ensure focus with slight delay to avoid timing issues after processCodeBlocks
    requestAnimationFrame(() => {
      rich.focus();
      const sel = window.getSelection();
      if (sel && rich.lastChild) {
        const range = document.createRange();
        range.selectNodeContents(rich.lastChild);
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });
  },

  showMarkdownEditor(tab) {
    const rich = document.getElementById('editor-rich');
    const textarea = document.getElementById('editor-textarea');
    rich.classList.add('hidden');
    textarea.classList.remove('hidden');
    textarea.value = tab.content;
    textarea.focus();
    this.updateWordCharCount(tab.content);
    this.updatePreview(tab.content);
  },

  toggleEditorMode() {
    if (this.activeTabIndex < 0) return;
    const tab = this.openTabs[this.activeTabIndex];
    if (this.editorMode === 'visual') {
      const rich = document.getElementById('editor-rich');
      tab.content = MarkdownParser.htmlToMarkdown(rich.innerHTML);
      this.editorMode = 'markdown';
      this.showMarkdownEditor(tab);
    } else {
      const textarea = document.getElementById('editor-textarea');
      tab.content = textarea.value;
      this.editorMode = 'visual';
      this.showVisualEditor(tab);
    }
    this.updateEditorModeUI();
  },

  updateEditorModeUI() {
    const btn = document.getElementById('btn-toggle-mode');
    if (btn) {
      btn.textContent = this.editorMode === 'visual' ? 'VISUAL' : 'MARKDOWN';
      btn.classList.toggle('active', this.editorMode === 'markdown');
    }
  },

  async saveCurrentFile() {
    if (this.activeTabIndex < 0) return;
    const tab = this.openTabs[this.activeTabIndex];
    if (!tab) return;
    if (this.editorMode === 'visual') {
      const rich = document.getElementById('editor-rich');
      tab.content = MarkdownParser.htmlToMarkdown(rich.innerHTML);
    } else {
      const textarea = document.getElementById('editor-textarea');
      tab.content = textarea.value;
    }
    await window.xo.writeFile(tab.path, tab.content);
    tab.unsaved = false;
    this.updateSaveIndicator(false);
    this.updateStatusMessage('Saved');
    this.renderTabs();
  },

  // ── Save As (choose name + format, saves into the vault) ──
  // mode: 'switch' (default) opens the newly written file, replacing the
  // active tab's focus. mode: 'copy' writes a duplicate alongside but keeps
  // editing the original note — nothing about the current tab changes.
  openSaveAsModal(mode) {
    if (this.activeTabIndex < 0) {
      this.updateStatusMessage('No note open to save');
      return;
    }
    this._saveAsMode = mode === 'copy' ? 'copy' : 'switch';
    const tab = this.openTabs[this.activeTabIndex];
    const nameInput = document.getElementById('save-as-name');
    if (nameInput) nameInput.value = tab.name.replace(/\.[^.]+$/, '');
    const title = document.getElementById('save-as-title');
    if (title) title.textContent = this._saveAsMode === 'copy' ? 'Save a Copy' : 'Save As';
    const confirmBtn = document.getElementById('save-as-confirm');
    if (confirmBtn) confirmBtn.textContent = this._saveAsMode === 'copy' ? 'Save Copy' : 'Save';
    const hint = document.getElementById('save-as-hint');
    if (hint) hint.textContent = this._saveAsMode === 'copy'
      ? 'Saves a duplicate into your vault — you keep editing the original note.'
      : 'Saves into your vault, next to the current note.';
    document.getElementById('save-as-modal').classList.remove('hidden');
    if (nameInput) { nameInput.focus(); nameInput.select(); }
  },

  closeSaveAsModal() {
    document.getElementById('save-as-modal').classList.add('hidden');
  },

  async confirmSaveAs() {
    if (this.activeTabIndex < 0) return;
    this._syncCurrentTabContent();
    const tab = this.openTabs[this.activeTabIndex];
    const nameInput = document.getElementById('save-as-name');
    const formatSel = document.getElementById('save-as-format');
    let name = (nameInput ? nameInput.value : '').trim().replace(/[<>:"/\\|?*]/g, '');
    const format = formatSel ? formatSel.value : 'md';
    if (!name) { this.updateStatusMessage('Enter a file name'); return; }

    // Save next to the current note if it lives in the vault, else vault root
    let dir = this.vaultPath;
    const lastSep = Math.max(tab.path.lastIndexOf('/'), tab.path.lastIndexOf('\\'));
    if (lastSep >= 0) {
      const tabDir = tab.path.substring(0, lastSep);
      if (tabDir.startsWith(this.vaultPath)) dir = tabDir;
    }
    const filePath = dir + '/' + name + '.' + format;

    // Don't silently overwrite an existing file
    try {
      const exists = await window.xo.fileExists(filePath);
      if (exists && !confirm(name + '.' + format + ' already exists. Overwrite it?')) return;
    } catch (e) { }

    let ok = false;
    const title = name;
    if (format === 'md') {
      ok = await window.xo.writeFile(filePath, tab.content);
    } else if (format === 'txt') {
      ok = await window.xo.writeFile(filePath, this._markdownToPlainText(tab.content));
    } else if (format === 'html') {
      ok = await window.xo.writeFile(filePath, this._buildExportHtml(title, tab.content));
    } else if (format === 'xml') {
      ok = await window.xo.writeFile(filePath, this._buildExportXml(title, tab.content));
    } else if (format === 'json') {
      ok = await window.xo.writeFile(filePath, JSON.stringify({
        title: title,
        exported: new Date().toISOString(),
        format: 'markdown',
        content: tab.content
      }, null, 2));
    } else if (format === 'pdf') {
      this.updateStatusMessage('Exporting PDF…');
      ok = await window.xo.exportPdf(this._buildExportHtml(title, tab.content, true), filePath);
    }

    this.closeSaveAsModal();
    const wasCopy = this._saveAsMode === 'copy';
    this._saveAsMode = 'switch';
    if (ok) {
      this.updateStatusMessage(wasCopy ? 'Copy saved as ' + name + '.' + format : 'Saved as ' + name + '.' + format);
      await this.loadFileTree();
      // Open editable text formats in a new tab — unless this was a "Save a
      // Copy", in which case we deliberately keep editing the original note.
      if (!wasCopy && (format === 'md' || format === 'txt')) {
        this.openFile(filePath, name + '.' + format);
      }
    } else {
      this.updateStatusMessage('Save failed for ' + name + '.' + format);
    }
  },

  // Markdown → readable plain text (strips syntax, keeps content)
  _markdownToPlainText(md) {
    return (md || '')
      .replace(/```[^\n]*\n([\s\S]*?)```/g, '$1')          // code fences → raw code
      .replace(/^#{1,6}\s+/gm, '')                          // headings
      .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')             // images → alt text
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')       // links → text (url)
      .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .replace(/~~(.+?)~~/g, '$1')
      .replace(/==(.+?)==/g, '$1')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/^>\s+/gm, '')                               // blockquotes
      .replace(/^---+$/gm, '----------------------------')  // hr
      .replace(/^[-*]\s+\[[ x]\]\s+/gm, '• ')               // checklists
      .replace(/^[-*]\s+/gm, '• ');                         // bullets
  },

  _escapeXml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  },

  _buildExportXml(title, content) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<note>\n' +
      '  <title>' + this._escapeXml(title) + '</title>\n' +
      '  <exported>' + new Date().toISOString() + '</exported>\n' +
      '  <format>markdown</format>\n' +
      '  <content><![CDATA[' + (content || '').replace(/\]\]>/g, ']]]]><![CDATA[>') + ']]></content>\n' +
      '</note>\n';
  },

  // Full standalone HTML document from the note (forPdf = print-friendly)
  _buildExportHtml(title, content, forPdf) {
    const body = MarkdownParser.parse(content || '');
    const bg = forPdf ? '#ffffff' : '#12121c';
    const fg = forPdf ? '#1a1a24' : '#e8e8f4';
    const accent = this.settings.accent || '#4fc3f7';
    return '<!DOCTYPE html>\n<html>\n<head>\n<meta charset="UTF-8">\n' +
      '<title>' + this._escapeXml(title) + '</title>\n<style>\n' +
      'body { font-family: "Segoe UI", Arial, sans-serif; background: ' + bg + '; color: ' + fg + '; ' +
      'max-width: 800px; margin: 0 auto; padding: 40px 24px; line-height: 1.65; }\n' +
      'h1, h2, h3, h4, h5, h6 { line-height: 1.3; }\n' +
      'a { color: ' + accent + '; }\n' +
      'code { background: rgba(127,127,127,0.15); padding: 2px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.9em; }\n' +
      'pre { background: rgba(127,127,127,0.12); padding: 14px; border-radius: 8px; overflow-x: auto; }\n' +
      'pre code { background: none; padding: 0; }\n' +
      'blockquote { border-left: 3px solid ' + accent + '; margin-left: 0; padding-left: 16px; opacity: 0.85; }\n' +
      'table { border-collapse: collapse; width: 100%; }\n' +
      'th, td { border: 1px solid rgba(127,127,127,0.35); padding: 8px 12px; text-align: left; }\n' +
      'img { max-width: 100%; }\n' +
      'mark { background: #fff176; color: #1a1a24; padding: 1px 4px; border-radius: 3px; }\n' +
      'hr { border: none; border-top: 1px solid rgba(127,127,127,0.35); margin: 24px 0; }\n' +
      '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
  },

  renderTabs() {
    const tabBar = document.getElementById('tab-bar');
    if (!tabBar) return;
    tabBar.innerHTML = '';
    this.openTabs.forEach((tab, idx) => {
      const div = document.createElement('div');
      div.className = 'tab-item' + (idx === this.activeTabIndex ? ' active' : '') + (tab.unsaved ? ' unsaved' : '');
      if (this.settings.projectTabMode) {
        div.innerHTML = '<span>' + tab.name + '</span><span class="tab-close">×</span>';
      } else {
        div.innerHTML = '<span>' + tab.name + '</span><span class="tab-close">×</span>';
      }
      div.querySelector('.tab-close').addEventListener('click', (e) => { e.stopPropagation(); this.closeTab(idx); });
      div.addEventListener('click', () => this.switchTab(idx));
      tabBar.appendChild(div);
    });
  },

  switchTab(index) {
    if (index === this.activeTabIndex) return;
    this._syncCurrentTabContent();
    this.activeTabIndex = index;
    this.showEditor(this.openTabs[index]);
    this.updateBreadcrumb(this.openTabs[index].path);
    this.highlightActiveTreeItem(this.openTabs[index].path);
    this.renderTabs();
    this.updateLinksPanel();
  },

  _syncCurrentTabContent() {
    if (this.activeTabIndex < 0) return;
    const tab = this.openTabs[this.activeTabIndex];
    if (this.editorMode === 'visual') {
      // Save code block states (collapse + label size) before syncing
      const rich = document.getElementById('editor-rich');
      this._saveCodeBlockStates(tab, rich);
      tab.content = MarkdownParser.htmlToMarkdown(rich.innerHTML);
    } else {
      const textarea = document.getElementById('editor-textarea');
      tab.content = textarea.value;
    }
  },

  closeTab(index) {
    const tab = this.openTabs[index];
    if (tab.unsaved && !confirm('Unsaved changes in ' + tab.name + '. Close anyway?')) return;
    this.openTabs.splice(index, 1);
    if (this.openTabs.length === 0) {
      this.activeTabIndex = -1;
      this.showDashboard();
    } else {
      const target = Math.min(index, this.openTabs.length - 1);
      // Force switchTab to actually refresh the editor even if the target
      // index numerically matches the old activeTabIndex — otherwise its
      // "already active" guard no-ops and the editor keeps showing the
      // just-closed tab's content while a different tab is "active"
      // underneath (and a Save would write that stale content to the
      // wrong file).
      this.activeTabIndex = -1;
      this.switchTab(target);
    }
    this.renderTabs();
  },

  processCodeBlocks() {
    const rich = document.getElementById('editor-rich');
    if (!rich) return;
    const tab = this.openTabs[this.activeTabIndex];
    if (tab && !tab.codeBlockStates) tab.codeBlockStates = {};

    rich.querySelectorAll('pre').forEach((pre, idx) => {
      if (pre.parentElement && pre.parentElement.classList.contains('code-block-wrapper')) {
        return;
      }

      // Extract language from code element class
      const existingCodeEls = pre.querySelectorAll('code');
      let lang = '';
      if (existingCodeEls.length > 0) {
        const cls = existingCodeEls[0].className || '';
        lang = cls.replace('language-', '').trim();
      }
      // Extract code text from the clean pre (fresh from parse)
      let codeText = this._extractCodeText(pre);
      // Auto-detect language if none specified
      if (!lang) lang = this._detectLanguage(codeText);

      // Clean up trailing empty line
      const lines = codeText.split('\n');
      if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
      codeText = lines.join('\n');

      // Check for label size encoded in markdown: ```lang {size:14px}
      let encodedLabelSize = '';
      if (lang) {
        const sizeMatch = lang.match(/\s*\{size:(\d+px)\}$/);
        if (sizeMatch) {
          encodedLabelSize = sizeMatch[1];
          lang = lang.replace(/\s*\{size:\d+px\}$/, '');
        }
      }

      // Rebuild pre with syntax-highlighted code elements
      this._renderCodeLines(pre, lines, lang);

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper code-preview';
      wrapper.setAttribute('data-block', 'code');

      // Create header
      const header = document.createElement('div');
      header.className = 'code-block-header';
      header.contentEditable = 'false';

      // Editable label
      const labelSpan = document.createElement('span');
      labelSpan.className = 'code-block-label';
      labelSpan.textContent = lang || 'Code';
      labelSpan.title = 'Click to rename · Right-click for size & delete';

      // Apply encoded label size from markdown
      if (encodedLabelSize) {
        labelSpan.style.fontSize = encodedLabelSize;
        header.style.fontSize = encodedLabelSize;
      }

      // Right-click context menu for label size + delete
      labelSpan.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        document.querySelectorAll('.code-label-size-menu').forEach(m => m.remove());
        const menu = document.createElement('div');
        menu.className = 'code-label-size-menu';
        menu.style.cssText = 'position:fixed;z-index:9999;background:var(--bg-secondary);border:1px solid var(--border);border-radius:8px;padding:6px 0;min-width:150px;box-shadow:0 8px 24px rgba(0,0,0,0.4);';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        const sizes = [
          { label: 'Small', value: '9px' },
          { label: 'Default', value: '10px' },
          { label: 'Medium', value: '12px' },
          { label: 'Large', value: '14px' },
          { label: 'Extra Large', value: '17px' },
          { label: 'XXL', value: '21px' },
          { label: 'XXXL', value: '26px' },
        ];
        sizes.forEach(s => {
          const item = document.createElement('div');
          item.textContent = s.label;
          const currentSize = labelSpan.style.fontSize || '10px';
          item.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:12px;color:var(--text-primary);transition:background 0.1s;' + (currentSize === s.value ? 'color:var(--accent);font-weight:700;' : '');
          item.addEventListener('mouseenter', () => { item.style.background = 'var(--bg-hover)'; });
          item.addEventListener('mouseleave', () => { item.style.background = 'none'; });
          item.addEventListener('click', () => {
            labelSpan.style.fontSize = s.value;
            header.style.fontSize = s.value;
            menu.remove();
            if (tab) this._saveCodeBlockStates(tab, rich);
            this.onRichEditorChange();
          });
          menu.appendChild(item);
        });
        // Separator
        const sep = document.createElement('div');
        sep.style.cssText = 'height:1px;background:var(--border);margin:4px 0;';
        menu.appendChild(sep);
        // Delete code block option
        const delItem = document.createElement('div');
        delItem.textContent = 'Delete Code Block';
        delItem.style.cssText = 'padding:6px 16px;cursor:pointer;font-size:12px;color:#ff6b6b;transition:background 0.1s;';
        delItem.addEventListener('mouseenter', () => { delItem.style.background = 'rgba(255,100,100,0.1)'; });
        delItem.addEventListener('mouseleave', () => { delItem.style.background = 'none'; });
        delItem.addEventListener('click', () => {
          menu.remove();
          // Replace wrapper with a paragraph
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          wrapper.parentNode.insertBefore(p, wrapper);
          wrapper.remove();
          this.onRichEditorChange();
        });
        menu.appendChild(delItem);
        document.body.appendChild(menu);
        const closeMenu = (ev) => {
          if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeMenu, true); }
        };
        setTimeout(() => document.addEventListener('click', closeMenu, true), 0);
      });

      labelSpan.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (header.querySelector('.code-block-label-input')) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = labelSpan.textContent;
        input.className = 'code-block-label-input';
        input.style.cssText = 'background:var(--bg-secondary);border:1px solid var(--accent);border-radius:4px;color:var(--text-primary);font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:2px 6px;outline:none;width:100px;';
        labelSpan.style.display = 'none';
        header.insertBefore(input, labelSpan.nextSibling);
        input.focus();
        input.select();
        const finishEdit = () => {
          const newLabel = input.value.trim() || 'Code';
          labelSpan.textContent = newLabel;
          labelSpan.style.display = '';
          input.remove();
          const newLang = newLabel.toLowerCase() !== 'code' ? newLabel.toLowerCase() : '';
          const currentCode = this._extractCodeText(pre);
          const newLines = currentCode.split('\n');
          this._renderCodeLines(pre, newLines, newLang);
          this.onRichEditorChange();
        };
        input.addEventListener('blur', finishEdit);
        input.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
          if (ev.key === 'Escape') { input.value = labelSpan.textContent; input.blur(); }
        });
      });

      // Collapse button
      const collapseBtn = document.createElement('button');
      collapseBtn.className = 'code-block-collapse-btn';
      collapseBtn.textContent = '◑';
      collapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (wrapper.classList.contains('code-collapsed')) {
          wrapper.classList.remove('code-collapsed');
          wrapper.classList.add('code-preview');
          collapseBtn.textContent = '◑';
        } else if (wrapper.classList.contains('code-preview')) {
          wrapper.classList.remove('code-preview');
          collapseBtn.textContent = '−';
        } else {
          wrapper.classList.add('code-collapsed');
          collapseBtn.textContent = '+';
        }
        if (tab) this._saveCodeBlockStates(tab, rich);
      });

      // Copy button — copies code block content to clipboard
      const copyBtn = document.createElement('button');
      copyBtn.className = 'code-block-copy-btn';
      copyBtn.title = 'Copy code to clipboard';
      copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      copyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const codeText = this._extractCodeText(pre);
        navigator.clipboard.writeText(codeText).then(() => {
          copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>';
          setTimeout(() => {
            copyBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
          }, 1500);
        });
      });

      // Intercept paste — strip formatting, insert as plain text node (fast, no execCommand lag)
      pre.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text/plain');
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          range.deleteContents();
          range.insertNode(document.createTextNode(text));
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        // Trigger content save since manual DOM manipulation doesn't fire input events
        this.onRichEditorChange();
      });

      header.appendChild(labelSpan);
      header.appendChild(copyBtn);
      header.appendChild(collapseBtn);
      pre.parentNode.insertBefore(wrapper, pre);
      wrapper.appendChild(header);
      wrapper.appendChild(pre);

      // Ensure a clickable paragraph after the code block
      let nextEl = wrapper.nextElementSibling;
      if (!nextEl || nextEl.classList.contains('code-block-wrapper') || nextEl.tagName === 'PRE') {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        p.contentEditable = 'true';
        wrapper.parentNode.insertBefore(p, wrapper.nextSibling);
      }
    });

    // Final safety: ensure the last child of rich is always a clickable <p>
    const lastChild = rich.lastElementChild;
    if (lastChild && (lastChild.classList.contains('code-block-wrapper') || lastChild.tagName === 'PRE')) {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      p.contentEditable = 'true';
      rich.appendChild(p);
    }
  },

  // Render code lines into a <pre> element (one <code> per line) with syntax highlighting
  _renderCodeLines(pre, lines, lang) {
    pre.innerHTML = '';
    pre.contentEditable = 'true';
    pre.style.fontFamily = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace";
    pre.style.fontSize = '13px';
    lines.forEach(line => {
      const codeEl = document.createElement('code');
      if (lang) codeEl.className = 'language-' + lang;
      // Apply syntax highlighting if language is known, otherwise just set text
      const highlighted = this._highlightLine(line, lang);
      if (highlighted !== null) {
        codeEl.innerHTML = highlighted;
      } else {
        codeEl.textContent = line || ' ';
      }
      pre.appendChild(codeEl);
    });
  },

  // HTML-escape a string for safe insertion into innerHTML
  _escapeCodeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },

  // Highlight a single line of code — returns HTML string or null if no highlighting
  // Uses a tokenizer approach: split into tokens first, then colorize and escape
  _highlightLine(text, lang) {
    if (!lang || !text.trim()) return null;
    const keywords = {
      'javascript': ['const','let','var','function','return','if','else','for','while','class','import','export','from','default','new','this','async','await','try','catch','throw','switch','case','break','continue','typeof','instanceof','in','of','null','undefined','true','false'],
      'js': ['const','let','var','function','return','if','else','for','while','class','import','export','from','default','new','this','async','await','try','catch','throw','switch','case','break','continue','typeof','instanceof','in','of','null','undefined','true','false'],
      'python': ['def','class','return','if','elif','else','for','while','import','from','as','try','except','finally','raise','with','yield','lambda','pass','break','continue','and','or','not','in','is','None','True','False','self','print','async','await'],
      'py': ['def','class','return','if','elif','else','for','while','import','from','as','try','except','finally','raise','with','yield','lambda','pass','break','continue','and','or','not','in','is','None','True','False','self','print','async','await'],
      'html': ['div','span','input','button','form','table','tr','td','th','a','img','link','script','style','head','body','html','meta','title','p','h1','h2','h3','ul','li','ol','section','header','footer','nav','main','article'],
      'css': ['color','background','border','margin','padding','display','flex','grid','position','width','height','font-size','font-weight','opacity','transform','transition','animation','box-shadow','z-index','overflow','align-items','justify-content'],
      'java': ['public','private','protected','class','interface','extends','implements','static','final','void','int','String','boolean','new','return','if','else','for','while','try','catch','throw','import','package','this','super','null','true','false'],
      'c': ['int','char','float','double','void','return','if','else','for','while','do','switch','case','break','continue','struct','typedef','enum','const','static','sizeof','include','define','NULL'],
      'cpp': ['int','char','float','double','void','return','if','else','for','while','do','switch','case','break','continue','class','struct','typedef','enum','const','static','sizeof','include','define','namespace','using','template','virtual','override','nullptr','true','false','new','delete','public','private','protected'],
      'rust': ['fn','let','mut','const','if','else','for','while','loop','match','return','struct','enum','impl','trait','use','mod','pub','self','super','crate','async','await','move','ref','true','false','None','Some','Ok','Err'],
      'go': ['func','var','const','if','else','for','range','switch','case','return','type','struct','interface','package','import','go','defer','chan','map','make','new','nil','true','false'],
      'typescript': ['const','let','var','function','return','if','else','for','while','class','import','export','from','default','new','this','async','await','try','catch','throw','interface','type','enum','extends','implements','readonly','as','null','undefined','true','false'],
      'ts': ['const','let','var','function','return','if','else','for','while','class','import','export','from','default','new','this','async','await','try','catch','throw','interface','type','enum','extends','implements','readonly','as','null','undefined','true','false'],
    };
    const langLower = lang.toLowerCase();
    const kws = keywords[langLower];
    if (!kws) return null;
    const kwSet = new Set(kws);
    const esc = (s) => this._escapeCodeHtml(s);

    // Tokenizer: split line into typed tokens, then render each with proper escaping + color
    const tokens = [];
    let i = 0;
    while (i < text.length) {
      const ch = text[i];
      // Single-line comment
      if (ch === '/' && text[i + 1] === '/') {
        tokens.push({ type: 'comment', value: text.slice(i) });
        i = text.length;
      }
      // Block comment start
      else if (ch === '/' && text[i + 1] === '*') {
        const end = text.indexOf('*/', i + 2);
        const val = end >= 0 ? text.slice(i, end + 2) : text.slice(i);
        tokens.push({ type: 'comment', value: val });
        i += val.length;
      }
      // Strings
      else if (ch === '"' || ch === "'" || ch === '`') {
        let j = i + 1;
        while (j < text.length && text[j] !== ch) {
          if (text[j] === '\\') j++;
          j++;
        }
        tokens.push({ type: 'string', value: text.slice(i, j + 1) });
        i = j + 1;
      }
      // # comment for Python
      else if (ch === '#' && (langLower === 'python' || langLower === 'py')) {
        tokens.push({ type: 'comment', value: text.slice(i) });
        i = text.length;
      }
      // Numbers
      else if (/\d/.test(ch) && (i === 0 || !/\w/.test(text[i - 1]))) {
        let j = i;
        while (j < text.length && /[\d.]/.test(text[j])) j++;
        tokens.push({ type: 'number', value: text.slice(i, j) });
        i = j;
      }
      // Words (identifiers / keywords)
      else if (/[a-zA-Z_$]/.test(ch)) {
        let j = i;
        while (j < text.length && /[\w$]/.test(text[j])) j++;
        const word = text.slice(i, j);
        tokens.push({ type: kwSet.has(word) ? 'keyword' : 'text', value: word });
        i = j;
      }
      // Everything else (operators, whitespace, symbols)
      else {
        let j = i;
        while (j < text.length && !/[a-zA-Z_$\d"'`#\/]/.test(text[j])) j++;
        if (j === i) j = i + 1;
        tokens.push({ type: 'text', value: text.slice(i, j) });
        i = j;
      }
    }

    // Render tokens to HTML
    return tokens.map(t => {
      const safe = esc(t.value);
      switch (t.type) {
        case 'keyword': return '<span style="color:#569cd6;font-weight:600">' + safe + '</span>';
        case 'string': return '<span style="color:#ce9178">' + safe + '</span>';
        case 'comment': return '<span style="color:#6a9955">' + safe + '</span>';
        case 'number': return '<span style="color:#b5cea8">' + safe + '</span>';
        default: return safe;
      }
    }).join('');
  },

  // Auto-detect programming language from code content
  _detectLanguage(code) {
    if (!code || code.length < 10) return '';
    const lower = code.toLowerCase();
    // HTML/XML
    if (/<!doctype|<html|<head|<body|<div|<span|<style|<script|<meta|<link/i.test(code)) return 'html';
    // CSS
    if (/\{[\s\S]*?[\w-]+\s*:\s*[\w#]+[\s\S]*?\}/.test(code) && /(@media|@import|@keyframes|:root|\.[\w-]+\s*\{|#[\w-]+\s*\{)/.test(code)) return 'css';
    // Python
    if (/\bdef\s+\w+\s*\(|import\s+\w+|from\s+\w+\s+import|print\s*\(|class\s+\w+.*:/.test(code)) return 'python';
    // TypeScript (check before JS)
    if (/\binterface\s+\w+|:\s*(string|number|boolean|void)\b|<\w+>/.test(code) && /\b(const|let|function|import)\b/.test(code)) return 'typescript';
    // JavaScript
    if (/\b(const|let|var)\s+\w+\s*=|function\s+\w+|=>\s*\{|require\s*\(|module\.exports|console\.log/.test(code)) return 'javascript';
    // Java
    if (/public\s+(static\s+)?(?:void|int|String|class)|System\.out\.print|import\s+java\./.test(code)) return 'java';
    // Rust
    if (/\bfn\s+\w+|let\s+mut\s+|impl\s+\w+|use\s+std::/.test(code)) return 'rust';
    // Go
    if (/\bfunc\s+\w+|package\s+main|import\s+"[^"]+"|fmt\.Print/.test(code)) return 'go';
    // C/C++
    if (/#include\s*[<"]|int\s+main\s*\(|printf\s*\(|std::/.test(code)) return 'cpp';
    return '';
  },

  // Robust code text extraction — handles all DOM states from contenteditable
  // Walks direct children of <pre>, treats each element as a line, handles text nodes from paste/edit
  _extractCodeText(pre) {
    const children = pre.childNodes;
    if (children.length === 0) return '';
    // If there's a single code element with newlines inside (fresh from parse)
    const codeEls = Array.from(pre.querySelectorAll(':scope > code'));
    if (codeEls.length === 1 && children.length === 1) {
      return codeEls[0].textContent;
    }
    // Multiple children: walk DOM in order, each direct child = one line
    const parts = [];
    for (const child of children) {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent;
        if (!t.trim() && !t.includes('\n')) continue; // skip whitespace between elements
        // Pasted text might have newlines in a text node — split them
        t.split('\n').forEach(line => parts.push(line));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        if (child.tagName === 'BR') {
          parts.push('');
        } else {
          // <code>, <div>, <span>, etc — get text content as one line
          parts.push(child.textContent);
        }
      }
    }
    return parts.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+|\n+$/g, '');
  },

  // Save all code block states (collapse + label size) for a tab
  _saveCodeBlockStates(tab, rich) {
    if (!tab || !rich) return;
    if (!tab.codeBlockStates) tab.codeBlockStates = {};
    const wrappers = rich.querySelectorAll('.code-block-wrapper');
    for (let i = 0; i < wrappers.length; i++) {
      const w = wrappers[i];
      let collapseState = 'full';
      if (w.classList.contains('code-collapsed')) collapseState = 'collapsed';
      else if (w.classList.contains('code-preview')) collapseState = 'preview';
      const label = w.querySelector('.code-block-label');
      const header = w.querySelector('.code-block-header');
      const labelSize = (label && label.style.fontSize) ? label.style.fontSize : '';
      // Store as object
      tab.codeBlockStates[i] = { collapse: collapseState, labelSize: labelSize };
    }
  },

  processTables() {
    const rich = document.getElementById('editor-rich');
    if (!rich) return;

    rich.querySelectorAll('table').forEach(table => {
      // Skip if already wrapped
      if (table.parentElement && table.parentElement.classList.contains('table-wrapper')) return;

      // Add editor-table class
      table.classList.add('editor-table');

      // Make all cells editable
      table.querySelectorAll('th, td').forEach(cell => {
        cell.contentEditable = 'true';
      });

      // Create wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      wrapper.contentEditable = 'false';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);

      // Add column button
      const addColBtn = document.createElement('button');
      addColBtn.className = 'table-btn-add-col';
      addColBtn.textContent = '+';
      addColBtn.title = 'Add Column';
      addColBtn.contentEditable = 'false';
      addColBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hRow = table.querySelector('thead tr') || table.querySelector('tr');
        if (hRow) {
          const isHeader = hRow.parentElement && hRow.parentElement.tagName.toLowerCase() === 'thead';
          const tag = isHeader ? 'th' : 'td';
          const cell = document.createElement(tag);
          cell.contentEditable = 'true';
          hRow.appendChild(cell);
        }
        // Add cells to all body rows
        table.querySelectorAll('tbody tr').forEach(row => {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          row.appendChild(td);
        });
        // If no thead/tbody, add td to all other rows
        if (!table.querySelector('thead') && !table.querySelector('tbody')) {
          const rows = table.querySelectorAll('tr');
          for (let i = 1; i < rows.length; i++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            rows[i].appendChild(td);
          }
        }
        this.onRichEditorChange();
      });
      wrapper.appendChild(addColBtn);

      // Add row button
      const addRowBtn = document.createElement('button');
      addRowBtn.className = 'table-btn-add-row';
      addRowBtn.textContent = '+';
      addRowBtn.title = 'Add Row';
      addRowBtn.contentEditable = 'false';
      addRowBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tbody = table.querySelector('tbody') || table;
        const firstRow = table.querySelector('tr');
        const colCount = firstRow ? firstRow.children.length : 2;
        const tr = document.createElement('tr');
        for (let i = 0; i < colCount; i++) {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          tr.appendChild(td);
        }
        tbody.appendChild(tr);
        this.onRichEditorChange();
      });
      wrapper.appendChild(addRowBtn);

      // Show buttons on focus/click into table, hide on click outside
      const showBtns = () => {
        addColBtn.classList.add('visible');
        addRowBtn.classList.add('visible');
      };
      const hideBtns = () => {
        addColBtn.classList.remove('visible');
        addRowBtn.classList.remove('visible');
      };

      // Show on click/focus into table cells
      table.addEventListener('focusin', showBtns);
      table.addEventListener('click', showBtns);

      // Hide when focus leaves the table wrapper entirely
      wrapper.addEventListener('focusout', (e) => {
        // Check if the new focus target is still inside the wrapper
        requestAnimationFrame(() => {
          if (!wrapper.contains(document.activeElement)) {
            hideBtns();
          }
        });
      });

      // Also handle clicks outside wrapper to hide
      document.addEventListener('click', (e) => {
        if (!wrapper.contains(e.target)) {
          hideBtns();
        }
      }, { capture: true });

      // Ensure there's a paragraph after for typing below
      if (!wrapper.nextElementSibling || wrapper.nextElementSibling.classList.contains('table-wrapper')) {
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        wrapper.parentNode.insertBefore(p, wrapper.nextSibling);
      }
    });
  },

  applyVisualFormatting(action) {
    const rich = document.getElementById('editor-rich');
    if (!rich) return;
    rich.focus();

    switch (action) {
      case 'bold': document.execCommand('bold', false, null); break;
      case 'italic': document.execCommand('italic', false, null); break;
      case 'strikethrough': document.execCommand('strikeThrough', false, null); break;
      case 'underline': document.execCommand('underline', false, null); break;
      case 'h1': {
        const current = document.queryCommandValue('formatBlock');
        if (current === 'h1') {
          document.execCommand('formatBlock', false, 'p');
        } else {
          document.execCommand('formatBlock', false, 'h1');
        }
        break;
      }
      case 'h2': {
        const current = document.queryCommandValue('formatBlock');
        if (current === 'h2') {
          document.execCommand('formatBlock', false, 'p');
        } else {
          document.execCommand('formatBlock', false, 'h2');
        }
        break;
      }
      case 'h3': {
        const current = document.queryCommandValue('formatBlock');
        if (current === 'h3') {
          document.execCommand('formatBlock', false, 'p');
        } else {
          document.execCommand('formatBlock', false, 'h3');
        }
        break;
      }
      case 'bullet': document.execCommand('insertUnorderedList', false, null); break;
      case 'checklist': {
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const text = sel.toString() || 'task';
          document.execCommand('insertHTML', false, '<ul><li class="checklist"><input type="checkbox"> ' + text + '</li></ul>');
          // Make the new checkboxes interactive
          rich.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.removeAttribute('disabled');
            cb.addEventListener('change', () => this.onRichEditorChange());
          });
        }
        break;
      }
      case 'code': {
        const sel = window.getSelection();
        const text = sel.toString() || '';
        // Insert a clean pre block with a paragraph after it
        const pre = document.createElement('pre');
        const codeEl = document.createElement('code');
        codeEl.textContent = text || ' ';
        pre.appendChild(codeEl);

        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(pre);

        // Add paragraph after for typing below
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        pre.parentNode.insertBefore(p, pre.nextSibling);

        // Process to add wrapper
        this.processCodeBlocks();

        // Place cursor inside the code block
        const newRange = document.createRange();
        const firstCode = pre.querySelector('code');
        if (firstCode) {
          newRange.selectNodeContents(firstCode);
          newRange.collapse(false);
          sel.removeAllRanges();
          sel.addRange(newRange);
        }
        break;
      }
      case 'link': {
        // Capture selection before the dialog steals focus
        const sel = window.getSelection();
        const savedRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
        const hadSelection = savedRange && !savedRange.collapsed;
        window.xo.showInputDialog('Insert Link', 'Enter URL:', 'https://').then(url => {
          if (!url || url === 'https://') return;
          const rich = document.getElementById('editor-rich');
          rich.focus();
          const selection = window.getSelection();
          if (savedRange) {
            selection.removeAllRanges();
            selection.addRange(savedRange);
          }
          if (hadSelection) {
            document.execCommand('createLink', false, url);
          } else {
            // No text selected — insert the URL itself as a clickable link
            const a = document.createElement('a');
            a.href = url;
            a.textContent = url;
            if (savedRange) {
              savedRange.insertNode(a);
              const range = document.createRange();
              range.setStartAfter(a);
              range.collapse(true);
              selection.removeAllRanges();
              selection.addRange(range);
            } else {
              rich.appendChild(a);
            }
          }
          this.onRichEditorChange();
        });
        return;
      }
      case 'highlight': {
        const sel = window.getSelection();
        if (sel.rangeCount && !sel.isCollapsed) {
          const range = sel.getRangeAt(0);
          const mark = document.createElement('mark');
          range.surroundContents(mark);
        }
        break;
      }
      case 'textcolor':
        document.execCommand('foreColor', false, this.textColorValue);
        break;
      case 'highlightcolor':
        document.execCommand('hiliteColor', false, this.highlightColorValue);
        break;
      case 'removeformat': {
        document.execCommand('removeFormat', false, null);
        document.execCommand('formatBlock', false, 'p');
        const sel = window.getSelection();
        if (sel.rangeCount) {
          const range = sel.getRangeAt(0);
          const container = range.commonAncestorContainer;
          const parent = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
          if (parent) {
            parent.querySelectorAll('mark').forEach(mark => {
              while (mark.firstChild) {
                mark.parentNode.insertBefore(mark.firstChild, mark);
              }
              mark.remove();
            });
            parent.querySelectorAll('[style*="background"]').forEach(el => {
              el.style.backgroundColor = '';
            });
            parent.querySelectorAll('font[color]').forEach(el => {
              while (el.firstChild) {
                el.parentNode.insertBefore(el.firstChild, el);
              }
              el.remove();
            });
          }
        }
        break;
      }
      case 'table': {
        const sel = window.getSelection();
        const range = sel.getRangeAt(0);

        const wrapper = document.createElement('div');
        wrapper.className = 'table-wrapper';
        wrapper.contentEditable = 'false';

        const table = document.createElement('table');
        table.className = 'editor-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        for (let i = 0; i < 2; i++) {
          const th = document.createElement('th');
          th.contentEditable = 'true';
          th.textContent = 'Header ' + (i + 1);
          headerRow.appendChild(th);
        }
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        const bodyRow = document.createElement('tr');
        for (let i = 0; i < 2; i++) {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.textContent = '';
          bodyRow.appendChild(td);
        }
        tbody.appendChild(bodyRow);
        table.appendChild(tbody);

        wrapper.appendChild(table);

        // Add column button
        const addColBtn = document.createElement('button');
        addColBtn.className = 'table-btn-add-col';
        addColBtn.textContent = '+';
        addColBtn.title = 'Add Column';
        addColBtn.contentEditable = 'false';
        addColBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const hRow = table.querySelector('thead tr');
          if (hRow) {
            const th = document.createElement('th');
            th.contentEditable = 'true';
            hRow.appendChild(th);
          }
          table.querySelectorAll('tbody tr').forEach(row => {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            row.appendChild(td);
          });
          this.onRichEditorChange();
        });
        wrapper.appendChild(addColBtn);

        // Add row button
        const addRowBtn = document.createElement('button');
        addRowBtn.className = 'table-btn-add-row';
        addRowBtn.textContent = '+';
        addRowBtn.title = 'Add Row';
        addRowBtn.contentEditable = 'false';
        addRowBtn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          const tbodyEl = table.querySelector('tbody');
          if (tbodyEl) {
            const colCount = table.querySelector('thead tr')?.children.length || 2;
            const tr = document.createElement('tr');
            for (let i = 0; i < colCount; i++) {
              const td = document.createElement('td');
              td.contentEditable = 'true';
              tr.appendChild(td);
            }
            tbodyEl.appendChild(tr);
          }
          this.onRichEditorChange();
        });
        wrapper.appendChild(addRowBtn);

        range.deleteContents();
        range.insertNode(wrapper);

        // Add paragraph after for typing below
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        wrapper.parentNode.insertBefore(p, wrapper.nextSibling);

        // Show/hide buttons on focus
        const showBtns = () => { addColBtn.classList.add('visible'); addRowBtn.classList.add('visible'); };
        const hideBtns = () => { addColBtn.classList.remove('visible'); addRowBtn.classList.remove('visible'); };
        table.addEventListener('focusin', showBtns);
        table.addEventListener('click', showBtns);
        wrapper.addEventListener('focusout', () => {
          requestAnimationFrame(() => { if (!wrapper.contains(document.activeElement)) hideBtns(); });
        });
        document.addEventListener('click', (ev) => { if (!wrapper.contains(ev.target)) hideBtns(); }, { capture: true });

        // Start with buttons visible since we just created the table
        showBtns();

        break;
      }
      case 'emoji': {
        this.showSymbolPicker();
        return;
      }
      case 'preview':
        this.togglePreview();
        return;
    }
    this.onRichEditorChange();
  },

  insertMarkdownFormatting(action) {
    const textarea = document.getElementById('editor-textarea');
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.substring(start, end);
    let before = '', after = '', insert = '';

    switch (action) {
      case 'bold': before = '**'; after = '**'; insert = selected || 'bold text'; break;
      case 'italic': before = '*'; after = '*'; insert = selected || 'italic text'; break;
      case 'strikethrough': before = '~~'; after = '~~'; insert = selected || 'text'; break;
      case 'underline': before = '<u>'; after = '</u>'; insert = selected || 'underlined text'; break;
      case 'h1': before = '# '; insert = selected || 'Heading 1'; break;
      case 'h2': before = '## '; insert = selected || 'Heading 2'; break;
      case 'h3': before = '### '; insert = selected || 'Heading 3'; break;
      case 'bullet': before = '- '; insert = selected || 'list item'; break;
      case 'checklist': before = '- [ ] '; insert = selected || 'task'; break;
      case 'code': before = '```\n'; after = '\n```'; insert = selected || 'code'; break;
      case 'link': before = '['; after = '](url)'; insert = selected || 'link text'; break;
      case 'highlight': before = '=='; after = '=='; insert = selected || 'highlighted'; break;
      case 'preview': this.togglePreview(); return;
      default: return;
    }

    const newContent = textarea.value.substring(0, start) + before + insert + after + textarea.value.substring(end);
    textarea.value = newContent;
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = start + before.length + insert.length;
    this.onMarkdownEditorChange();
  },

  insertFormatting(action) {
    if (this.editorMode === 'visual') {
      this.applyVisualFormatting(action);
    } else {
      this.insertMarkdownFormatting(action);
    }
  },

  initTableControls() {
    const rich = document.getElementById('editor-rich');
    if (!rich) return;

    // Remove old table control buttons
    document.querySelectorAll('.table-btn-add-col, .table-btn-add-row').forEach(b => b.remove());

    rich.querySelectorAll('.editor-table').forEach(table => {
      if (table.dataset.controlsInit) return;
      table.dataset.controlsInit = 'true';

      // Create add column button (right side)
      const addColBtn = document.createElement('button');
      addColBtn.className = 'table-btn-add-col';
      addColBtn.textContent = '+';
      addColBtn.title = 'Add Column';
      addColBtn.contentEditable = 'false';

      // Create add row button (bottom)
      const addRowBtn = document.createElement('button');
      addRowBtn.className = 'table-btn-add-row';
      addRowBtn.textContent = '+';
      addRowBtn.title = 'Add Row';
      addRowBtn.contentEditable = 'false';

      // Wrap table in a relative container
      const wrapper = document.createElement('div');
      wrapper.className = 'table-wrapper';
      wrapper.contentEditable = 'false';
      table.parentNode.insertBefore(wrapper, table);
      wrapper.appendChild(table);
      wrapper.appendChild(addColBtn);
      wrapper.appendChild(addRowBtn);

      // Add column
      addColBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
          const th = document.createElement('th');
          th.contentEditable = 'true';
          th.textContent = '';
          headerRow.appendChild(th);
        }
        table.querySelectorAll('tbody tr').forEach(row => {
          const td = document.createElement('td');
          td.contentEditable = 'true';
          td.textContent = '';
          row.appendChild(td);
        });
        this.onRichEditorChange();
      });

      // Add row
      addRowBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tbody = table.querySelector('tbody');
        if (tbody) {
          const colCount = table.querySelector('thead tr')?.children.length || 2;
          const tr = document.createElement('tr');
          for (let i = 0; i < colCount; i++) {
            const td = document.createElement('td');
            td.contentEditable = 'true';
            td.textContent = '';
            tr.appendChild(td);
          }
          tbody.appendChild(tr);
        }
        this.onRichEditorChange();
      });

      // Show/hide buttons on focus
      table.addEventListener('focusin', () => {
        addColBtn.classList.add('visible');
        addRowBtn.classList.add('visible');
      });
      table.addEventListener('focusout', () => {
        setTimeout(() => {
          if (!table.contains(document.activeElement) && document.activeElement !== addColBtn && document.activeElement !== addRowBtn) {
            addColBtn.classList.remove('visible');
            addRowBtn.classList.remove('visible');
          }
        }, 100);
      });
    });
  },

  showSymbolPicker() {
    const rich = document.getElementById('editor-rich');
    if (!rich) return;

    const symbols = ['★', '☆', '✦', '✧', '●', '○', '◆', '◇', '▲', '▼', '►', '◄', '✓', '✗', '✚', '♦', '♥', '♣', '♠', '⚡', '✿', '✶', '→', '←', '↑', '↓', '⇒', '⇐', '➤', '•', '◉', '⊕', '⊗', '☐', '☑', '☒', '①', '②', '③', '④', '⑤', '※', '†', '‡', '§', '¶', '©', '®', '™', '∞', '≈', '≠', '≤', '≥', '±', '×', '÷', '∑', '√', 'π', 'Ω', 'α', 'β'];

    const popup = document.createElement('div');
    popup.id = 'symbol-picker';
    popup.style.cssText = 'position: fixed; background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 8px; padding: 12px; z-index: 1000; display: grid; grid-template-columns: repeat(8, 1fr); gap: 4px; width: fit-content; box-shadow: var(--shadow);';

    symbols.forEach(symbol => {
      const btn = document.createElement('button');
      btn.textContent = symbol;
      btn.style.cssText = 'background: none; border: 1px solid var(--border); border-radius: 4px; padding: 8px 6px; color: var(--text-primary); cursor: pointer; font-size: 14px; transition: all 0.15s; min-width: 32px;';
      btn.addEventListener('mouseenter', () => {
        btn.style.background = 'var(--accent-dim)';
        btn.style.borderColor = 'var(--accent)';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.background = 'none';
        btn.style.borderColor = 'var(--border)';
      });
      btn.addEventListener('click', () => {
        document.execCommand('insertText', false, symbol);
        popup.remove();
        rich.focus();
        this.onRichEditorChange();
      });
      popup.appendChild(btn);
    });

    document.body.appendChild(popup);
    const rect = document.querySelector('.toolbar-btn[data-action="emoji"]').getBoundingClientRect();
    popup.style.top = (rect.bottom + 8) + 'px';
    popup.style.left = (rect.left - popup.offsetWidth / 2 + rect.width / 2) + 'px';

    const closeHandler = (e) => {
      if (!popup.contains(e.target) && !document.querySelector('.toolbar-btn[data-action="emoji"]').contains(e.target)) {
        popup.remove();
        document.removeEventListener('click', closeHandler);
      }
    };
    document.addEventListener('click', closeHandler);
  },

  onRichEditorChange() {
    if (this.activeTabIndex < 0) return;
    const tab = this.openTabs[this.activeTabIndex];
    const rich = document.getElementById('editor-rich');
    // Save code block states (collapse + label size) on every change
    this._saveCodeBlockStates(tab, rich);
    tab.content = MarkdownParser.htmlToMarkdown(rich.innerHTML);
    tab.unsaved = true;
    this.updateSaveIndicator(true);
    this.updateWordCharCount(tab.content);
    this.renderTabs();
    this.scheduleLinksPanelUpdate();
    this.clearAutoSaveTimer();
    this.autoSaveTimer = setTimeout(() => {
      if (this.settings.autoSave) this.saveCurrentFile();
    }, 2000);
  },

  linksPanelTimer: null,

  scheduleLinksPanelUpdate() {
    if (this.linksPanelTimer) clearTimeout(this.linksPanelTimer);
    this.linksPanelTimer = setTimeout(() => this.updateLinksPanel(), 800);
  },

  onMarkdownEditorChange() {
    if (this.activeTabIndex < 0) return;
    const tab = this.openTabs[this.activeTabIndex];
    const textarea = document.getElementById('editor-textarea');
    tab.content = textarea.value;
    tab.unsaved = true;
    this.updateSaveIndicator(true);
    this.updateWordCharCount(tab.content);
    this.renderTabs();
    this.scheduleLinksPanelUpdate();
    this.updatePreview(tab.content);
    this.clearAutoSaveTimer();
    this.autoSaveTimer = setTimeout(() => {
      if (this.settings.autoSave) this.saveCurrentFile();
    }, 2000);
  },

  updatePreview(content) {
    const preview = document.getElementById('editor-preview');
    if (!preview) return;
    const html = MarkdownParser.parse(content);
    preview.innerHTML = html || '<p>No content</p>';
  },

  togglePreview() {
    this.previewMode = !this.previewMode;
    const editor = document.getElementById('editor-wrapper');
    if (editor) editor.classList.toggle('preview-mode', this.previewMode);
  },

  clearAutoSaveTimer() {
    if (this.autoSaveTimer) clearTimeout(this.autoSaveTimer);
  },

  updateSaveIndicator(unsaved) {
    const indicator = document.getElementById('save-indicator');
    if (indicator) indicator.textContent = unsaved ? '⦿' : '✓';
  },

  updateWordCharCount(text) {
    text = text || '';
    const words = (text.match(/\S+/g) || []).length;
    const chars = text.length;
    const wordEl = document.getElementById('word-count');
    const charEl = document.getElementById('char-count');
    if (wordEl) wordEl.textContent = words + (words === 1 ? ' word' : ' words');
    if (charEl) charEl.textContent = chars + (chars === 1 ? ' char' : ' chars');
  },

  updateBreadcrumb(filePath) {
    const parts = filePath.split('/');
    const breadcrumb = document.getElementById('breadcrumb');
    if (!breadcrumb) return;
    breadcrumb.innerHTML = parts.map((p, i) => '<span class="breadcrumb-item">' + p + '</span>').join('<span class="breadcrumb-sep">/</span>');
    // Click the path to reveal the file in the OS file explorer
    breadcrumb.classList.add('breadcrumb-clickable');
    breadcrumb.title = 'Click to show in File Explorer';
    breadcrumb.onclick = () => window.xo.showInExplorer(filePath);
  },

  async openFile(filePath, fileName) {
    try {
      let content = await window.xo.readFile(filePath);
      if (content === null || content === undefined) {
        this.updateStatusMessage('Could not read ' + fileName);
        return;
      }
      // Strip BOM if present so first line renders correctly
      if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
      const existingTab = this.openTabs.findIndex(t => t.path === filePath);
      if (existingTab >= 0) {
        this.switchTab(existingTab);
      } else {
        this.openTabs.push({ path: filePath, name: fileName, content: content, unsaved: false });
        this.activeTabIndex = this.openTabs.length - 1;
        this.showEditor(this.openTabs[this.activeTabIndex]);
        this.renderTabs();
      }
      this.updateBreadcrumb(filePath);
      this.highlightActiveTreeItem(filePath);
      this.addRecent(filePath, fileName);
      this.renderRecent();
      this.updateLinksPanel();
    } catch (e) { console.error('Open file error:', e); }
  },

  // ── Editor link handling: Ctrl+Click opens URL, hover shows hint ──
  _initEditorLinkHandling() {
    // Shared tooltip element
    let tooltip = document.getElementById('link-tooltip');
    if (!tooltip) {
      tooltip = document.createElement('div');
      tooltip.id = 'link-tooltip';
      tooltip.className = 'link-tooltip hidden';
      document.body.appendChild(tooltip);
    }
    let hideTimer = null;

    const showTooltip = (anchor, text, autoHide) => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      tooltip.textContent = text;
      tooltip.classList.remove('hidden');
      const rect = anchor.getBoundingClientRect();
      tooltip.style.left = Math.max(8, Math.min(rect.left, window.innerWidth - 320)) + 'px';
      tooltip.style.top = Math.max(8, rect.top - 34) + 'px';
      if (autoHide) hideTimer = setTimeout(() => tooltip.classList.add('hidden'), 1800);
    };
    const hideTooltip = () => {
      if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
      tooltip.classList.add('hidden');
    };

    const resolveUrl = (a) => {
      let url = a.getAttribute('href') || '';
      if (url && !/^[a-z]+:/i.test(url)) url = 'https://' + url;
      return url;
    };

    ['editor-rich', 'editor-preview'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;

      el.addEventListener('click', (e) => {
        const a = e.target.closest('a');
        if (!a || !el.contains(a)) return;
        e.preventDefault(); // never navigate inside the app
        const url = resolveUrl(a);
        if (!url) return;
        if (e.ctrlKey || e.metaKey) {
          window.xo.openExternal(url);
          this.updateStatusMessage('Opening ' + url);
          hideTooltip();
        } else {
          // Plain click: hint the user how to open it
          showTooltip(a, 'Ctrl+Click to open', true);
        }
      });

      el.addEventListener('mouseover', (e) => {
        const a = e.target.closest('a');
        if (!a || !el.contains(a)) return;
        const url = resolveUrl(a);
        if (!url) return;
        showTooltip(a, url + '  —  Ctrl+Click to open', false);
      });

      el.addEventListener('mouseout', (e) => {
        if (e.target.closest && e.target.closest('a')) hideTooltip();
      });
    });
  },

  // ── Links panel (right sidebar) — lists every link in the current note ──
  updateLinksPanel() {
    const container = document.getElementById('file-backlinks');
    if (!container) return;
    const tab = this.activeTabIndex >= 0 ? this.openTabs[this.activeTabIndex] : null;
    if (!tab || !tab.content) {
      container.innerHTML = '<p class="sidebar-empty">No links</p>';
      return;
    }
    const links = [];
    const seen = new Set();
    // Markdown links [text](url) — skip images ![alt](src)
    for (const m of tab.content.matchAll(/(?<!!)\[([^\]]+)\]\(([^)\s]+)\)/g)) {
      const key = m[2];
      if (seen.has(key)) continue;
      seen.add(key);
      links.push({ type: 'url', text: m[1], url: m[2] });
    }
    // Wiki-style [[links]]
    for (const name of MarkdownParser.extractLinks(tab.content)) {
      if (seen.has('[[' + name + ']]')) continue;
      seen.add('[[' + name + ']]');
      links.push({ type: 'wiki', text: name, url: name });
    }
    // Bare URLs
    for (const m of tab.content.matchAll(/(?<![("\[])\bhttps?:\/\/[^\s)"\]]+/g)) {
      if (seen.has(m[0])) continue;
      seen.add(m[0]);
      links.push({ type: 'url', text: m[0], url: m[0] });
    }
    if (links.length === 0) {
      container.innerHTML = '<p class="sidebar-empty">No links</p>';
      return;
    }
    container.innerHTML = '';
    links.forEach(link => {
      const div = document.createElement('div');
      div.className = 'sidebar-link-item';
      div.title = link.type === 'url' ? link.url + '\nClick to open in browser' : 'Open note "' + link.url + '"';
      const icon = link.type === 'url'
        ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>'
        : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>';
      div.innerHTML = icon + '<span class="sidebar-link-text"></span>';
      div.querySelector('.sidebar-link-text').textContent = link.text;
      div.addEventListener('click', async () => {
        if (link.type === 'url') {
          let url = link.url;
          if (!/^[a-z]+:/i.test(url)) url = 'https://' + url;
          window.xo.openExternal(url);
        } else {
          // Wiki link: search vault for a matching note
          const results = await window.xo.searchFiles(link.url);
          const match = (results || []).find(r => r.nameMatch);
          if (match) this.openFile(match.path, match.name);
          else this.updateStatusMessage('Note "' + link.url + '" not found');
        }
      });
      container.appendChild(div);
    });
  },

  async createNewFile() {
    const name = await window.xo.showInputDialog('New File', 'File name:', 'untitled');
    if (!name) return;
    const filePath = this.vaultPath + '/' + name + '.md';
    await window.xo.writeFile(filePath, '# ' + name + '\n\n');
    await this.loadFileTree();
    this.openFile(filePath, name + '.md');
  },

  // "Quick Note" (left rail) — skips the name prompt entirely so it's
  // actually quick: creates a note with an auto-generated title (bumping
  // a number if that title's already taken) and opens it immediately,
  // ready to type. Rename it later the same way as any other note.
  async createQuickNote() {
    const base = 'Untitled Note';
    let name = base;
    let n = 2;
    while (await window.xo.fileExists(this.vaultPath + '/' + name + '.md')) {
      name = base + ' ' + n;
      n++;
    }
    const filePath = this.vaultPath + '/' + name + '.md';
    await window.xo.writeFile(filePath, '');
    await this.loadFileTree();
    this.openFile(filePath, name + '.md');
  },

  async createNewFolder() {
    const name = await window.xo.showInputDialog('New Folder', 'Folder name:', 'New Folder');
    if (!name) return;
    const folderPath = this.vaultPath + '/' + name;
    await window.xo.createFolder(folderPath);
    await this.loadFileTree();
  },

  async startRenameInline(div, item) {
    const nameSpan = div.querySelector('.tree-name');
    if (!nameSpan) return;
    const oldName = nameSpan.textContent;
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldName;
    input.className = 'tree-rename-input';
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let renameFinished = false;
    const finishRename = async () => {
      if (renameFinished) return;
      renameFinished = true;
      const newName = input.value.trim();
      if (newName && newName !== oldName) {
        // Get the directory part of the path (handle both / and \)
        const lastSep = Math.max(item.path.lastIndexOf('/'), item.path.lastIndexOf('\\'));
        const dir = lastSep >= 0 ? item.path.substring(0, lastSep + 1) : '';
        const newPath = dir + newName;
        try {
          await window.xo.renameItem(item.path, newPath);
          // Update any open tabs that reference this file
          this.openTabs.forEach(tab => {
            if (tab.path === item.path) {
              tab.path = newPath;
              tab.name = newName;
            }
          });
          this.renderTabs();
          await this.loadFileTree();
        } catch (e) { console.error('Rename error:', e); }
      } else {
        const newNameSpan = document.createElement('span');
        newNameSpan.className = 'tree-name';
        newNameSpan.textContent = oldName;
        input.replaceWith(newNameSpan);
      }
    };

    input.addEventListener('blur', finishRename);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finishRename();
      if (e.key === 'Escape') {
        const newNameSpan = document.createElement('span');
        newNameSpan.className = 'tree-name';
        newNameSpan.textContent = oldName;
        input.replaceWith(newNameSpan);
      }
    });
  },

  clearFileInfo() {
    const fileInfo = document.getElementById('file-info');
    if (fileInfo) fileInfo.innerHTML = '';
  },

  highlightActiveTreeItem(filePath) {
    document.querySelectorAll('.tree-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === filePath);
    });
  },

  addRecent(filePath, fileName) {
    const idx = this.recentFiles.findIndex(f => f.path === filePath);
    if (idx >= 0) this.recentFiles.splice(idx, 1);
    this.recentFiles.unshift({ path: filePath, name: fileName });
    if (this.recentFiles.length > 20) this.recentFiles.pop();
    this.saveSettings();
  },

  renderRecent() {
    // Right sidebar recent
    const container = document.getElementById('sidebar-recent');
    if (container) {
      container.innerHTML = '';
      if (this.recentFiles.length === 0) {
        container.innerHTML = '<p class="sidebar-empty">No recent notes</p>';
      } else {
        this.recentFiles.slice(0, 10).forEach(file => {
          const div = document.createElement('div');
          div.className = 'sidebar-link';
          const nameSpan = document.createElement('span');
          nameSpan.className = 'sidebar-link-name';
          nameSpan.textContent = file.name;
          div.appendChild(nameSpan);
          const removeBtn = document.createElement('button');
          removeBtn.className = 'sidebar-link-remove';
          removeBtn.textContent = '✕';
          removeBtn.title = 'Remove from recent';
          removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeRecent(file.path);
          });
          div.appendChild(removeBtn);
          div.addEventListener('click', () => this.openFile(file.path, file.name));
          container.appendChild(div);
        });
      }
    }
    // Also update left rail
    this.renderLeftRailRecent();
  },

  removeRecent(filePath) {
    const idx = this.recentFiles.findIndex(f => f.path === filePath);
    if (idx >= 0) this.recentFiles.splice(idx, 1);
    this.saveSettings();
    this.renderRecent();
  },

  clearRecent() {
    if (this.recentFiles.length === 0) return;
    if (!confirm('Clear all recent notes? This only clears the list, your files are untouched.')) return;
    this.recentFiles = [];
    this.saveSettings();
    this.renderRecent();
    this.updateStatusMessage('Recent notes cleared');
  },

  toggleStar(filePath) {
    const idx = this.starred.indexOf(filePath);
    if (idx >= 0) {
      this.starred.splice(idx, 1);
    } else {
      this.starred.push(filePath);
    }
    this.saveSettings();
  },

  renderStarred() {
    // Left rail starred - handled by renderLeftRailStarred
    this.renderLeftRailStarred();
  },

  setColorTag(path, color) {
    this.colorTags[path] = color;
    this.saveSettings();
    this.loadFileTree();
  },

  updateStatusMessage(message) {
    const status = document.getElementById('status-text');
    if (!status) return;
    status.textContent = message;
    setTimeout(() => { status.textContent = 'Ready'; }, 3000);
  },

  showContextMenu(x, y, item) {
    const menu = document.getElementById('context-menu');
    if (!menu) return;
    this.contextTarget = item;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';
    menu.classList.remove('hidden');
    // Save / Save As / Save a Copy only make sense for files, not folders
    menu.querySelectorAll('.ctx-file-only').forEach(el => {
      el.classList.toggle('hidden', !!item.isDirectory);
    });
  },

  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) menu.classList.add('hidden');
    this.contextMenuVisible = false;
  },

  async handleContextAction(action) {
    const item = this.contextTarget;
    if (!item) return;

    switch (action) {
      case 'open': {
        if (!item.isDirectory) {
          this.openFile(item.path, item.name);
        }
        break;
      }
      case 'rename': {
        const allItems = document.querySelectorAll('.tree-item');
        let div = null;
        allItems.forEach(el => { if (el.dataset.path === item.path) div = el; });
        if (div) this.startRenameInline(div, item);
        break;
      }
      case 'delete': {
        if (this.settings.confirmDelete) {
          if (!confirm('Delete ' + item.name + '?')) break;
        }
        try {
          await window.xo.deleteItem(item.path);
          this.updateStatusMessage('Deleted');
          await this.loadFileTree();
        } catch (e) { console.error('Delete error:', e); }
        break;
      }
      case 'star': {
        this.toggleStar(item.path);
        this.renderStarred();
        await this.loadFileTree();
        break;
      }
      case 'pin': {
        if (item.isDirectory) {
          const idx = this.pinnedFolders.indexOf(item.path);
          if (idx >= 0) {
            this.pinnedFolders.splice(idx, 1);
          } else {
            this.pinnedFolders.push(item.path);
          }
          this.saveSettings();
          await this.loadFileTree();
        }
        break;
      }
      case 'color': {
        const picker = document.getElementById('color-picker');
        if (picker) {
          picker.style.left = event.clientX + 'px';
          picker.style.top = event.clientY + 'px';
          picker.classList.remove('hidden');
          const colors = ['#ef5350', '#ff9800', '#fff176', '#81c784', '#4fc3f7', '#ce93d8'];
          picker.innerHTML = colors.map(c => '<div class="color-dot" style="background:' + c + '" data-color="' + c + '"></div>').join('');
          picker.querySelectorAll('.color-dot').forEach(opt => {
            opt.addEventListener('click', () => {
              this.colorTags[item.path] = opt.dataset.color;
              this.saveSettings();
              this.loadFileTree();
              picker.classList.add('hidden');
            });
          });
        }
        break;
      }
      case 'blocksize': {
        const sizes = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', 'xxxl'];
        const picker = document.getElementById('blocksize-picker');
        if (picker) {
          picker.style.left = event.clientX + 'px';
          picker.style.top = event.clientY + 'px';
          picker.classList.remove('hidden');
          picker.innerHTML = sizes.map(s => '<div class="blocksize-dot" data-size="' + s + '">' + s.toUpperCase() + '</div>').join('');
          picker.querySelectorAll('.blocksize-dot').forEach(opt => {
            opt.addEventListener('click', () => {
              this.blockSizes[item.path] = opt.dataset.size;
              this.saveSettings();
              this.loadFileTree();
              picker.classList.add('hidden');
            });
          });
        }
        break;
      }
      case 'colortoggle': {
        const currentStyle = this.colorTagStyles[item.path] || 'minimal';
        this.colorTagStyles[item.path] = currentStyle === 'minimal' ? 'block' : 'minimal';
        this.saveSettings();
        await this.loadFileTree();
        break;
      }
      case 'duplicate': {
        try {
          const content = await window.xo.readFile(item.path);
          const ext = item.name.match(/(\.[^.]+)$/)?.[1] || '';
          const baseName = item.name.replace(/(\.[^.]+)$/, '');
          const newPath = item.path.replace(item.name, baseName + ' copy' + ext);
          await window.xo.writeFile(newPath, content || '');
          this.updateStatusMessage('Duplicated');
          await this.loadFileTree();
        } catch (e) { console.error('Duplicate error:', e); }
        break;
      }
      case 'explorer': {
        window.xo.showInExplorer(item.path);
        break;
      }
      case 'save': {
        if (item.isDirectory) break;
        const activeTab = this.activeTabIndex >= 0 ? this.openTabs[this.activeTabIndex] : null;
        if (activeTab && activeTab.path === item.path) {
          await this.saveCurrentFile();
        } else {
          // Not the open tab, so there are no live edits to persist —
          // what's on disk already matches what's in the vault.
          this.updateStatusMessage('Already up to date');
        }
        break;
      }
      case 'save-as': {
        if (item.isDirectory) break;
        await this._sidebarSaveAs(item, false);
        break;
      }
      case 'save-copy': {
        if (item.isDirectory) break;
        await this._sidebarSaveAs(item, true);
        break;
      }
      case 'copy-path': {
        try {
          await navigator.clipboard.writeText(item.path);
          this.updateStatusMessage('Path copied');
        } catch (e) { this.updateStatusMessage('Copy failed'); }
        break;
      }
      case 'icon': {
        const icons = ['file', 'folder', 'star', 'dollar', 'heart', 'flag', 'bookmark', 'lightning', 'music', 'rocket'];
        const picker = document.getElementById('icon-picker');
        if (picker) {
          picker.style.left = event.clientX + 'px';
          picker.style.top = event.clientY + 'px';
          picker.classList.remove('hidden');
          picker.innerHTML = icons.map(ic => '<div class="icon-option" data-icon="' + ic + '">' + this.getCustomIconSVG(ic) + '</div>').join('');
          picker.querySelectorAll('.icon-option').forEach(opt => {
            opt.addEventListener('click', () => {
              this.customIcons[item.path] = opt.dataset.icon;
              this.saveSettings();
              this.loadFileTree();
              picker.classList.add('hidden');
            });
          });
        }
        break;
      }
    }
    this.hideContextMenu();
  },

  // Save As / Save a Copy from the sidebar right-click menu. Works off the
  // live editor content if `item` is the currently open tab (so unsaved
  // edits aren't lost), otherwise reads the file fresh from disk. Keeps the
  // same extension as the source file — format conversion stays a toolbar
  // Save As (Ctrl+Shift+S) feature.
  async _sidebarSaveAs(item, keepCurrent) {
    const activeTab = this.activeTabIndex >= 0 ? this.openTabs[this.activeTabIndex] : null;
    const isOpenTab = activeTab && activeTab.path === item.path;
    let content;
    if (isOpenTab) {
      this._syncCurrentTabContent();
      content = activeTab.content;
    } else {
      content = await window.xo.readFile(item.path);
      if (content === null || content === undefined) {
        this.updateStatusMessage('Could not read ' + item.name);
        return;
      }
    }
    const extMatch = item.name.match(/(\.[^.]+)$/);
    const ext = extMatch ? extMatch[1] : '';
    const baseName = item.name.replace(/(\.[^.]+)$/, '');
    const promptDefault = baseName + (keepCurrent ? ' copy' : '');
    const newBase = await window.xo.showInputDialog(keepCurrent ? 'Save a Copy' : 'Save As', 'File name:', promptDefault);
    if (!newBase) return;
    const cleanName = newBase.trim().replace(/[<>:"/\\|?*]/g, '');
    if (!cleanName) { this.updateStatusMessage('Enter a file name'); return; }

    const lastSep = Math.max(item.path.lastIndexOf('/'), item.path.lastIndexOf('\\'));
    const dir = lastSep >= 0 ? item.path.substring(0, lastSep) : this.vaultPath;
    const newPath = dir + '/' + cleanName + ext;

    try {
      const exists = await window.xo.fileExists(newPath);
      if (exists && !confirm(cleanName + ext + ' already exists. Overwrite it?')) return;
    } catch (e) { }

    const ok = await window.xo.writeFile(newPath, content || '');
    if (!ok) { this.updateStatusMessage('Save failed for ' + cleanName + ext); return; }

    this.updateStatusMessage((keepCurrent ? 'Copy saved as ' : 'Saved as ') + cleanName + ext);
    await this.loadFileTree();
    // "Save As" moves you forward into the new file; "Save a Copy" leaves
    // you exactly where you were.
    if (!keepCurrent) this.openFile(newPath, cleanName + ext);
  },

  quickCaptureSaveNew() {
    const textarea = document.getElementById('quick-capture-text');
    const content = textarea.value;
    if (!content.trim()) return;
    const fileName = new Date().toISOString().slice(0, 10) + '-' + Math.random().toString(36).substr(2, 9) + '.md';
    const filePath = this.vaultPath + '/Quick Notes/' + fileName;
    window.xo.writeFile(filePath, content);
    textarea.value = '';
    document.getElementById('quick-capture-modal').classList.add('hidden');
    this.updateStatusMessage('Quick note saved');
    this.loadFileTree();
  },

  quickCaptureAppend() {
    const textarea = document.getElementById('quick-capture-text');
    const content = textarea.value;
    if (!content.trim()) return;
    if (this.activeTabIndex >= 0) {
      const tab = this.openTabs[this.activeTabIndex];
      tab.content += '\n\n' + content;
      tab.unsaved = true;
      this.updateSaveIndicator(true);
      this.renderTabs();
    }
    textarea.value = '';
    document.getElementById('quick-capture-modal').classList.add('hidden');
    this.updateStatusMessage('Content appended');
  },

  // ── Widgets ──
  startClocks() {
    this.renderAnalogClock();
    setInterval(() => this.renderAnalogClock(), 1000);
  },

  renderAnalogClock() {
    const canvas = document.getElementById('analog-clock-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const center = size / 2;
    const radius = center - 8;

    ctx.clearRect(0, 0, size, size);

    const tz = this.settings.clocks[0]?.tz || 'local';
    const now = new Date();
    let hours, minutes, seconds;
    if (tz === 'local') {
      hours = now.getHours(); minutes = now.getMinutes(); seconds = now.getSeconds();
    } else {
      try {
        const str = now.toLocaleString('en-US', { timeZone: tz, hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const parts = str.split(':');
        hours = parseInt(parts[0]); minutes = parseInt(parts[1]); seconds = parseInt(parts[2]);
      } catch (e) {
        hours = 0; minutes = 0; seconds = 0;
      }
    }

    const accent = this.settings.accent || '#4fc3f7';
    const style = this.clockFaceStyle;

    // Draw clock face based on style
    ctx.beginPath();
    ctx.arc(center, center, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = accent + '44';
    ctx.lineWidth = 2;
    ctx.stroke();

    if (style === 0 || style === 1 || style === 2 || style === 4) {
      // Hour markers (0=classic, 1=minimal, 2=roman, 4=luxury)
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI / 6) - Math.PI / 2;
        if (style === 2) {
          // Roman numerals
          const roman = ['XII', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI'];
          ctx.save();
          ctx.font = '10px serif';
          ctx.fillStyle = accent;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const x = center + (radius - 15) * Math.cos(angle);
          const y = center + (radius - 15) * Math.sin(angle);
          ctx.fillText(roman[i], x, y);
          ctx.restore();
        } else if (style === 4) {
          // Luxury gold ticks
          const inner = radius - 10;
          const outer = radius - 2;
          ctx.beginPath();
          ctx.moveTo(center + inner * Math.cos(angle), center + inner * Math.sin(angle));
          ctx.lineTo(center + outer * Math.cos(angle), center + outer * Math.sin(angle));
          ctx.strokeStyle = '#d4af37';
          ctx.lineWidth = i % 3 === 0 ? 3 : 1.5;
          ctx.stroke();
        } else {
          // Classic or minimal
          const inner = radius - 8;
          const outer = radius - 2;
          ctx.beginPath();
          ctx.moveTo(center + inner * Math.cos(angle), center + inner * Math.sin(angle));
          ctx.lineTo(center + outer * Math.cos(angle), center + outer * Math.sin(angle));
          ctx.strokeStyle = (style === 1) ? 'transparent' : (accent + '88');
          ctx.lineWidth = i % 3 === 0 ? 2 : 1;
          ctx.stroke();
        }
      }
    }

    // Hour hand
    const hourAngle = ((hours % 12) + minutes / 60) * (Math.PI / 6) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + (radius * 0.5) * Math.cos(hourAngle), center + (radius * 0.5) * Math.sin(hourAngle));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Minute hand
    const minAngle = (minutes + seconds / 60) * (Math.PI / 30) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + (radius * 0.7) * Math.cos(minAngle), center + (radius * 0.7) * Math.sin(minAngle));
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Second hand
    const secAngle = seconds * (Math.PI / 30) - Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + (radius * 0.8) * Math.cos(secAngle), center + (radius * 0.8) * Math.sin(secAngle));
    ctx.strokeStyle = accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(center, center, 3, 0, 2 * Math.PI);
    ctx.fillStyle = accent;
    ctx.fill();

    // Digital overlay for style 3
    if (style === 3) {
      ctx.save();
      ctx.font = 'bold 18px "JetBrains Mono", monospace';
      ctx.fillStyle = accent;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const timeStr = String(hours % 12 || 12).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
      ctx.fillText(timeStr, center, center + radius * 0.38);
      ctx.restore();
    }

    // Face indicator dots
    const clockBox = document.getElementById('widget-clock-box');
    if (clockBox) {
      let indicator = clockBox.querySelector('.widget-face-indicator');
      if (!indicator) {
        indicator = document.createElement('div');
        indicator.className = 'widget-face-indicator';
        clockBox.appendChild(indicator);
      }
      indicator.innerHTML = Array.from({length: 5}, (_, i) =>
        '<span class="widget-face-dot' + (i === style ? ' active' : '') + '"></span>'
      ).join('');
    }
  },

  updateDateWidget() {
    const box = document.getElementById('widget-date-box');
    if (!box) return;
    const now = new Date();
    const dayNames = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const style = this.dateFaceStyle;

    const monthNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const accent = this.settings.accent || '#4fc3f7';
    let html = '';
    // Face indicator dots
    const dots = Array.from({length: 5}, (_, i) => '<span class="widget-face-dot' + (i === style ? ' active' : '') + '"></span>').join('');
    const dotHtml = '<div class="widget-face-indicator">' + dots + '</div>';

    if (style === 0) {
      // Classic big number
      html = '<div class="widget-date-number">' + now.getDate() + '</div>' +
             '<div class="widget-date-day">' + dayNames[now.getDay()] + '</div>' +
             '<div class="widget-date-motto">LETS GET THIS <span class="motto-dollar">$</span></div>';
    } else if (style === 1) {
      // Circular ring
      html = '<div class="date-face-ring">' +
             '<div style="font-size:48px;font-weight:900;color:' + accent + ';line-height:1;font-family:\'JetBrains Mono\',monospace;">' + now.getDate() + '</div>' +
             '<div style="font-size:11px;font-weight:700;letter-spacing:3px;color:var(--text-primary);margin-top:2px;">' + dayNames[now.getDay()] + '</div>' +
             '</div>' +
             '<div class="widget-date-motto" style="margin-top:6px;">LETS GET THIS <span class="motto-dollar">$</span></div>';
    } else if (style === 2) {
      // Minimal text
      html = '<div style="font-size:13px;font-weight:800;letter-spacing:4px;color:var(--text-dim);text-transform:uppercase;">' + monthNames[now.getMonth()] + '</div>' +
             '<div class="widget-date-number" style="font-size:72px;">' + now.getDate() + '</div>' +
             '<div class="widget-date-motto">LETS GET THIS <span class="motto-dollar">$</span></div>';
    } else if (style === 3) {
      // Calendar card
      html = '<div class="date-face-card">' +
             '<div class="date-face-card-top">' + monthNames[now.getMonth()] + '</div>' +
             '<div class="date-face-card-body">' +
             '<div style="font-size:52px;font-weight:900;color:var(--text-primary);line-height:1;font-family:\'JetBrains Mono\',monospace;">' + now.getDate() + '</div>' +
             '<div style="font-size:11px;font-weight:700;letter-spacing:3px;color:var(--text-dim);margin-top:4px;">' + dayNames[now.getDay()] + '</div>' +
             '</div></div>' +
             '<div class="widget-date-motto" style="margin-top:8px;">LETS GET THIS <span class="motto-dollar">$</span></div>';
    } else if (style === 4) {
      // Neon glow
      html = '<div class="date-face-neon">' +
             '<div class="widget-date-number" style="text-shadow:0 0 20px ' + accent + ',0 0 40px ' + accent + ',0 0 80px ' + accent + ';">' + now.getDate() + '</div>' +
             '<div class="widget-date-day" style="color:' + accent + ';text-shadow:0 0 10px ' + accent + ';">' + dayNames[now.getDay()] + '</div>' +
             '</div>' +
             '<div class="widget-date-motto">LETS GET THIS <span class="motto-dollar">$</span></div>';
    }

    box.innerHTML = html + dotHtml;
  },

  updateWidgetVisibility() {
    const clocksEl = document.getElementById('widget-clocks');
    const calBlock = document.getElementById('widget-calendar-block');
    const logoEl = document.querySelector('.widget-section');
    const bar = document.getElementById('widgets-bar');
    const leftRail = document.querySelector('.left-rail');

    if (clocksEl) clocksEl.style.display = this.settings.showClocks ? 'flex' : 'none';
    if (calBlock) calBlock.style.display = this.settings.showCalendar ? 'block' : 'none';
    if (logoEl) logoEl.style.display = this.settings.showLogo ? 'flex' : 'none';
    const barVisible = this.settings.showClocks || this.settings.showCalendar;
    if (bar) bar.style.display = barVisible ? 'block' : 'none';

    this.applyCalendarCollapsedState();
    this.reserveLeftRailBottomSpace();
  },

  // #widgets-bar floats fixed over the bottom of the left rail, which hides
  // "Quick Note" (and the logo) underneath it whenever the calendar/clocks
  // widget is showing. Reserve room in the rail's own flow so Quick Note
  // sits above the overlay instead of behind it; with both widgets off, or
  // if the bar's height changes (e.g. a 4th clock wraps to a new row), this
  // keeps the reserved space in sync.
  reserveLeftRailBottomSpace() {
    const bar = document.getElementById('widgets-bar');
    const leftRail = document.querySelector('.left-rail');
    if (!leftRail) return;
    const barVisible = bar && bar.style.display !== 'none';
    const reserve = (barVisible && bar) ? (bar.offsetHeight + 14) : 0;
    leftRail.style.paddingBottom = reserve + 'px';
  },

  applyCalendarCollapsedState() {
    const calBlock = document.getElementById('widget-calendar-block');
    if (calBlock) calBlock.classList.toggle('collapsed', !!this.settings.calendarCollapsed);
  },

  toggleWidgetCalendarCollapse() {
    this.settings.calendarCollapsed = !this.settings.calendarCollapsed;
    this.updateWidgetVisibility();
    this.saveSettings();
  },

  // ── Widget Bar Clocks (bottom-left mini clocks) ──
  startWidgetBarClocks() {
    this.updateWidgetBarClocks();
    setInterval(() => this.updateWidgetBarClocks(), 1000);
  },

  updateWidgetBarClocks() {
    const container = document.getElementById('widget-clocks');
    if (!container) return;
    const prevCount = container.children.length;
    container.innerHTML = '';
    this.settings.clocks.forEach(clock => {
      const div = document.createElement('div');
      div.className = 'clock-widget';
      div.innerHTML = '<div class="clock-label">' + clock.label + '</div><div class="clock-time">' + this._getClockTime(clock.tz) + '</div>';
      container.appendChild(div);
    });
    // Clock count changed (added/removed a timezone) — the bar's height may
    // have changed too (clocks wrap onto a new row past 3), so re-sync the
    // space reserved for Quick Note underneath it.
    if (prevCount !== this.settings.clocks.length) this.reserveLeftRailBottomSpace();
  },

  // ── Left Rail: Spaces, Recent, Starred ──
  renderSpaces() {
    const container = document.getElementById('workspace-list');
    if (!container) return;
    container.innerHTML = '';
    // Show top-level folders as spaces
    const folders = this.fileTree.filter(item => item.isDirectory);
    folders.forEach(folder => {
      const div = document.createElement('div');
      div.className = 'rail-item';
      const tagColor = this.colorTags[folder.path] || 'var(--accent)';
      div.innerHTML = '<span class="color-indicator" style="background:' + tagColor + ';"></span><span>' + folder.name + '</span>';
      div.addEventListener('click', () => {
        this.folderHistory.push(this.currentFolderPath);
        this.currentFolderPath = folder.path;
        this.renderFileTree(folder.children);
      });
      container.appendChild(div);
    });
  },

  renderLeftRailRecent() {
    const container = document.getElementById('recent-list');
    if (!container) return;
    container.innerHTML = '';
    this.recentFiles.slice(0, 8).forEach(file => {
      const div = document.createElement('div');
      div.className = 'rail-item';
      div.textContent = file.name;
      div.addEventListener('click', () => this.openFile(file.path, file.name));
      container.appendChild(div);
    });
  },

  renderLeftRailStarred() {
    const container = document.getElementById('starred-list');
    if (!container) return;
    container.innerHTML = '';
    this.starred.forEach(filePath => {
      const parts = filePath.split(/[\\/]/);
      const fileName = parts[parts.length - 1];
      const div = document.createElement('div');
      div.className = 'rail-item';
      div.innerHTML = '<span style="color:#ffd700;font-size:9px;margin-right:4px;">★</span><span class="rail-item-name">' + fileName + '</span>';
      div.addEventListener('click', () => this.openFile(filePath, fileName));
      div.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Show a mini context menu to unstar
        const existing = document.getElementById('starred-context-menu');
        if (existing) existing.remove();
        const menu = document.createElement('div');
        menu.id = 'starred-context-menu';
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.innerHTML = '<div class="ctx-item" data-action="unstar">Unstar</div>';
        document.body.appendChild(menu);
        menu.querySelector('[data-action="unstar"]').addEventListener('click', () => {
          this.toggleStar(filePath);
          this.renderLeftRailStarred();
          this.loadFileTree();
          menu.remove();
        });
        const closeHandler = (ev) => {
          if (!ev.target.closest('#starred-context-menu')) { menu.remove(); document.removeEventListener('click', closeHandler); }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 10);
      });
      container.appendChild(div);
    });
  },

  // ── Collapsible Sections ──
  initCollapsibleSections() {
    document.querySelectorAll('.rail-header').forEach(header => {
      if (header.classList.contains('clickable')) return;
      const section = header.closest('.rail-section');
      const list = section ? section.querySelector('.rail-list') : null;
      if (!list) return;
      const toggle = document.createElement('span');
      toggle.className = 'section-toggle';
      toggle.textContent = '▾';
      toggle.style.cssText = 'margin-left:auto;font-size:8px;cursor:pointer;transition:transform 0.2s;';
      header.appendChild(toggle);
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const isCollapsed = list.classList.toggle('section-collapsed');
        toggle.style.transform = isCollapsed ? 'rotate(-90deg)' : '';
      });
    });
    document.querySelectorAll('.sidebar-header').forEach(header => {
      const section = header.closest('.sidebar-section');
      if (!section) return;
      const content = section.querySelector('.sidebar-content');
      if (!content) return;
      const toggle = document.createElement('span');
      toggle.className = 'section-toggle';
      toggle.textContent = '▾';
      toggle.style.cssText = 'margin-left:auto;font-size:8px;cursor:pointer;transition:transform 0.2s;';
      header.appendChild(toggle);
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const isCollapsed = content.classList.toggle('section-collapsed');
        toggle.style.transform = isCollapsed ? 'rotate(-90deg)' : '';
      });
    });
  },

  // ── Sidebar Toggles ──
  toggleLeftRail() {
    this.leftRailHidden = !this.leftRailHidden;
    const rail = document.getElementById('left-rail');
    const btn = document.getElementById('btn-toggle-left-rail');
    const widgetsBar = document.getElementById('widgets-bar');
    if (rail) rail.classList.toggle('panel-hidden', this.leftRailHidden);
    if (btn) {
      btn.textContent = this.leftRailHidden ? '▶' : '◀';
      btn.classList.toggle('panel-is-hidden', this.leftRailHidden);
    }
    if (widgetsBar) {
      widgetsBar.style.display = this.leftRailHidden ? 'none' : '';
    }
    if (!this.leftRailHidden) this.syncWidgetsBarWidth();
  },

  toggleRightSidebar() {
    this.rightSidebarHidden = !this.rightSidebarHidden;
    const sidebar = document.getElementById('right-sidebar');
    const btn = document.getElementById('btn-toggle-right-sidebar');
    if (sidebar) sidebar.classList.toggle('panel-hidden', this.rightSidebarHidden);
    if (btn) {
      btn.textContent = this.rightSidebarHidden ? '◀' : '▶';
      btn.classList.toggle('panel-is-hidden', this.rightSidebarHidden);
    }
  },

  // ── Sticky Notes & Tasks (Dashboard) ──
  renderStickyNotes() {
    const container = document.getElementById('sticky-notes-list');
    if (!container) return;
    container.innerHTML = '';
    this.stickyNotes.forEach((note, idx) => {
      const tile = document.createElement('div');
      tile.className = 'sticky-tile';
      const bgColor = note.color || 'transparent';
      const iconHtml = note.icon ? '<span class="sticky-icon">' + this.getCustomIconSVG(note.icon) + '</span>' : '';
      const textSize = note.textSize || 'medium';
      tile.style.backgroundColor = bgColor;
      tile.innerHTML = '<button class="sticky-close" data-idx="' + idx + '">✕</button>' + iconHtml + '<div class="sticky-text sticky-text-' + textSize + '" contenteditable="true">' + (note.text || '') + '</div>';

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showStickyContextMenu(e, 'note', idx);
      });

      tile.querySelector('.sticky-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.stickyNotes.splice(idx, 1);
        this.saveSettings();
        this.renderStickyNotes();
      });
      tile.querySelector('.sticky-text').addEventListener('blur', (e) => {
        this.stickyNotes[idx].text = e.target.textContent;
        this.saveSettings();
      });
      container.appendChild(tile);
    });
  },

  addStickyNote() {
    this.stickyNotes.push({ text: '', color: '', icon: '', textSize: 'medium' });
    this.saveSettings();
    this.renderStickyNotes();
    // Focus the new note
    setTimeout(() => {
      const tiles = document.querySelectorAll('#sticky-notes-list .sticky-text');
      if (tiles.length > 0) tiles[tiles.length - 1].focus();
    }, 50);
  },

  renderStickyTasks() {
    const container = document.getElementById('sticky-tasks-list');
    if (!container) return;
    container.innerHTML = '';
    this.stickyTasks.forEach((task, idx) => {
      const tile = document.createElement('div');
      tile.className = 'sticky-tile sticky-task-tile';
      const bgColor = task.color || 'transparent';
      const iconHtml = task.icon ? '<span class="sticky-icon">' + this.getCustomIconSVG(task.icon) + '</span>' : '';
      const textSize = task.textSize || 'medium';
      tile.style.backgroundColor = bgColor;
      tile.innerHTML = '<button class="sticky-close" data-idx="' + idx + '">✕</button>' +
        '<label class="sticky-task-check"><input type="checkbox"' + (task.done ? ' checked' : '') + '></label>' +
        iconHtml +
        '<div class="sticky-text sticky-text-' + textSize + (task.done ? ' done' : '') + '" contenteditable="true">' + (task.text || '') + '</div>';

      tile.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.showStickyContextMenu(e, 'task', idx);
      });

      tile.querySelector('.sticky-close').addEventListener('click', (e) => {
        e.stopPropagation();
        this.stickyTasks.splice(idx, 1);
        this.saveSettings();
        this.renderStickyTasks();
      });
      tile.querySelector('input[type="checkbox"]').addEventListener('change', (e) => {
        this.stickyTasks[idx].done = e.target.checked;
        tile.querySelector('.sticky-text').classList.toggle('done', e.target.checked);
        this.saveSettings();
      });
      tile.querySelector('.sticky-text').addEventListener('blur', (e) => {
        this.stickyTasks[idx].text = e.target.textContent;
        this.saveSettings();
      });
      container.appendChild(tile);
    });
  },

  addStickyTask() {
    this.stickyTasks.push({ text: '', done: false, color: '', icon: '', textSize: 'medium' });
    this.saveSettings();
    this.renderStickyTasks();
    setTimeout(() => {
      const tiles = document.querySelectorAll('#sticky-tasks-list .sticky-text');
      if (tiles.length > 0) tiles[tiles.length - 1].focus();
    }, 50);
  },

  showStickyContextMenu(e, type, idx) {
    const existing = document.getElementById('sticky-context-menu');
    if (existing) existing.remove();

    const menu = document.createElement('div');
    menu.id = 'sticky-context-menu';
    menu.className = 'context-menu';
    menu.style.left = e.clientX + 'px';
    menu.style.top = e.clientY + 'px';

    const colors = ['#ef5350', '#ff9800', '#fff176', '#81c784', '#4fc3f7', '#ce93d8', ''];
    const colorOptions = colors.map(c =>
      '<div class="sticky-color-option" data-color="' + c + '" style="width:24px;height:24px;border-radius:50%;background:' + (c || '#555') + ';border:2px solid ' + (c ? 'transparent' : 'rgba(255,255,255,0.3)') + ';cursor:pointer;display:inline-block;' + (c === '' ? 'position:relative;' : '') + '">' + (c === '' ? '<span style="position:absolute;top:-2px;left:6px;font-size:14px;">✕</span>' : '') + '</div>'
    ).join('');

    const icons = ['file', 'star', 'heart', 'flag', 'lightning', 'check', 'alert'];
    const iconOptions = icons.map(icon =>
      '<button class="sticky-icon-option" data-icon="' + icon + '" style="background:none;border:1px solid var(--border);padding:6px;border-radius:6px;cursor:pointer;color:var(--text-secondary);" title="' + icon + '">' +
      (icon === 'star' ? '★' : icon === 'heart' ? '♥' : icon === 'flag' ? '⚐' : icon === 'lightning' ? '⚡' : icon === 'check' ? '✓' : icon === 'alert' ? '⚠' : '📄') +
      '</button>'
    ).join('');

    menu.innerHTML =
      '<div style="padding:8px;border-bottom:1px solid var(--border);">' +
        '<div style="font-size:9px;color:var(--text-dim);margin-bottom:8px;font-weight:700;letter-spacing:1px;">COLOR</div>' +
        '<div style="display:flex;gap:6px;">' + colorOptions + '</div>' +
      '</div>' +
      '<div style="padding:8px;border-bottom:1px solid var(--border);">' +
        '<div style="font-size:9px;color:var(--text-dim);margin-bottom:8px;font-weight:700;letter-spacing:1px;">ICON</div>' +
        '<div style="display:flex;gap:4px;flex-wrap:wrap;">' + iconOptions + '</div>' +
      '</div>' +
      '<div style="padding:8px;">' +
        '<div style="font-size:9px;color:var(--text-dim);margin-bottom:8px;font-weight:700;letter-spacing:1px;">SIZE</div>' +
        '<div style="display:flex;gap:4px;">' +
          '<button class="sticky-size-option" data-size="small" style="background:var(--bg-tertiary);border:1px solid var(--border);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:10px;color:var(--text-secondary);">Small</button>' +
          '<button class="sticky-size-option" data-size="medium" style="background:var(--bg-tertiary);border:1px solid var(--border);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;color:var(--text-secondary);">Medium</button>' +
          '<button class="sticky-size-option" data-size="large" style="background:var(--bg-tertiary);border:1px solid var(--border);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:14px;color:var(--text-secondary);">Large</button>' +
          '<button class="sticky-size-option" data-size="xlarge" style="background:var(--bg-tertiary);border:1px solid var(--border);padding:6px 10px;border-radius:6px;cursor:pointer;font-size:16px;color:var(--text-secondary);">XL</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(menu);

    const list = type === 'note' ? this.stickyNotes : this.stickyTasks;

    menu.querySelectorAll('.sticky-color-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const color = opt.dataset.color;
        list[idx].color = color;
        this.saveSettings();
        type === 'note' ? this.renderStickyNotes() : this.renderStickyTasks();
        menu.remove();
      });
    });

    menu.querySelectorAll('.sticky-icon-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const icon = opt.dataset.icon;
        list[idx].icon = icon;
        this.saveSettings();
        type === 'note' ? this.renderStickyNotes() : this.renderStickyTasks();
        menu.remove();
      });
    });

    menu.querySelectorAll('.sticky-size-option').forEach(opt => {
      opt.addEventListener('click', () => {
        const size = opt.dataset.size;
        list[idx].textSize = size;
        this.saveSettings();
        type === 'note' ? this.renderStickyNotes() : this.renderStickyTasks();
        menu.remove();
      });
    });

    const closeHandler = (ev) => { if (!ev.target.closest('#sticky-context-menu')) { menu.remove(); document.removeEventListener('click', closeHandler); } };
    setTimeout(() => document.addEventListener('click', closeHandler), 10);
  },

  toggleDashboardPanel(panelId) {
    const panel = document.getElementById(panelId);
    const btn = document.querySelector('[data-toggle-panel="' + panelId + '"]');
    if (panel) {
      const hidden = panel.classList.toggle('section-collapsed');
      if (btn) btn.textContent = hidden ? '▶' : '▼';
    }
  },

  // ── Stopwatch ──
  initStopwatch() {
    this.updateStopwatchDisplay();
  },

  toggleStopwatch() {
    if (this.stopwatchRunning) {
      // Pause
      this.stopwatchElapsed += Date.now() - this.stopwatchStart;
      this.stopwatchRunning = false;
      clearInterval(this.stopwatchInterval);
      this.stopwatchInterval = null;
      const btn = document.getElementById('stopwatch-start');
      if (btn) { btn.textContent = 'START'; btn.classList.remove('active'); }
    } else {
      // Start
      this.stopwatchStart = Date.now();
      this.stopwatchRunning = true;
      this.stopwatchInterval = setInterval(() => this.updateStopwatchDisplay(), 50);
      const btn = document.getElementById('stopwatch-start');
      if (btn) { btn.textContent = 'PAUSE'; btn.classList.add('active'); }
    }
  },

  resetStopwatch() {
    this.stopwatchRunning = false;
    this.stopwatchElapsed = 0;
    this.stopwatchStart = 0;
    if (this.stopwatchInterval) clearInterval(this.stopwatchInterval);
    this.stopwatchInterval = null;
    const btn = document.getElementById('stopwatch-start');
    if (btn) { btn.textContent = 'START'; btn.classList.remove('active'); }
    this.updateStopwatchDisplay();
  },

  updateStopwatchDisplay() {
    const total = this.stopwatchRunning ? this.stopwatchElapsed + (Date.now() - this.stopwatchStart) : this.stopwatchElapsed;
    const mins = Math.floor(total / 60000);
    const secs = Math.floor((total % 60000) / 1000);
    const ms = Math.floor((total % 1000) / 10);

    const style = this.stopwatchFaceStyle;
    const accent = this.settings.accent || '#4fc3f7';
    const display = document.getElementById('stopwatch-display');
    const msEl = document.getElementById('stopwatch-ms');
    const box = document.getElementById('widget-stopwatch-box');
    if (!display || !box) return;

    if (style === 0) {
      // Classic digital
      display.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
      display.style.cssText = 'font-size:28px;';
      if (msEl) { msEl.textContent = '.' + String(ms).padStart(2,'0'); msEl.style.cssText = ''; }
    } else if (style === 1) {
      // Big seconds
      display.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
      display.style.cssText = 'font-size:36px;color:' + accent + ';';
      if (msEl) { msEl.textContent = '.' + String(ms).padStart(2,'0'); msEl.style.cssText = 'font-size:18px;color:' + accent + ';'; }
    } else if (style === 2) {
      // Minimal thin
      display.textContent = mins + ':' + String(secs).padStart(2,'0');
      display.style.cssText = 'font-size:32px;font-weight:300;letter-spacing:4px;';
      if (msEl) { msEl.textContent = ''; msEl.style.cssText = ''; }
    } else if (style === 3) {
      // Full display with hours
      const hrs = Math.floor(total / 3600000);
      display.textContent = String(hrs).padStart(2,'0') + ':' + String(mins % 60).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
      display.style.cssText = 'font-size:22px;';
      if (msEl) { msEl.textContent = '.' + String(ms).padStart(2,'0'); msEl.style.cssText = 'font-size:12px;'; }
    } else if (style === 4) {
      // Neon glow
      display.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
      display.style.cssText = 'font-size:30px;color:' + accent + ';text-shadow:0 0 20px ' + accent + ',0 0 40px ' + accent + ';';
      if (msEl) { msEl.textContent = '.' + String(ms).padStart(2,'0'); msEl.style.cssText = 'color:' + accent + ';text-shadow:0 0 10px ' + accent + ';'; }
    }

    // Face indicator dots
    let indicator = box.querySelector('.widget-face-indicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.className = 'widget-face-indicator';
      box.appendChild(indicator);
    }
    indicator.innerHTML = Array.from({length: 5}, (_, i) =>
      '<span class="widget-face-dot' + (i === style ? ' active' : '') + '"></span>'
    ).join('');
  },

  // ── Dashboard Widgets (Draggable & Resizable) ──
  resetDashboardLayout() {
    this.settings.widgetPositions = {};
    this.settings.widgetSizes = {};
    this.dashboardLocked = true;
    this.saveSettings();
    this.initDashboardWidgets();
  },

  initDashboardWidgets() {
    const dashboard = document.getElementById('home-dashboard');
    if (!dashboard) return;

    dashboard.style.position = 'relative';

    const widgets = [
      { el: document.querySelector('.dashboard-stickies'), id: 'dashboard-stickies' },
      { el: document.querySelector('.dashboard-calendar-widget'), id: 'dashboard-calendar-widget' },
      { el: document.querySelector('.dashboard-clocks-widget'), id: 'dashboard-clocks-widget' }
    ];

    widgets.forEach(widget => {
      if (!widget.el) return;

      const saved = this.settings.widgetPositions[widget.id];
      const savedSize = this.settings.widgetSizes[widget.id];

      if (savedSize && !this.dashboardLocked) {
        widget.el.style.width = savedSize.width + 'px';
        widget.el.style.height = savedSize.height + 'px';
      }

      if (!this.dashboardLocked) {
        this._makeWidgetResizable(widget.el, widget.id);
      }
    });
  },

  _makeWidgetResizable(el, id) {
    const handle = document.createElement('div');
    handle.style.cssText = 'position: absolute; width: 12px; height: 12px; right: 4px; bottom: 4px; cursor: se-resize; background: var(--accent); opacity: 0.3; border-radius: 2px; z-index: 100;';
    el.style.position = 'relative';
    el.appendChild(handle);

    let isResizing = false;
    let startX, startY, startWidth, startHeight;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startWidth = el.offsetWidth;
      startHeight = el.offsetHeight;
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const newWidth = Math.max(150, startWidth + dx);
      const newHeight = Math.max(100, startHeight + dy);
      el.style.width = newWidth + 'px';
      el.style.height = newHeight + 'px';
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        if (!this.settings.widgetSizes) this.settings.widgetSizes = {};
        this.settings.widgetSizes[id] = {
          width: el.offsetWidth,
          height: el.offsetHeight
        };
        this.saveSettings();
      }
    });
  },

  toggleDashboardLock() {
    this.dashboardLocked = !this.dashboardLocked;
    this.saveSettings();

    const lockBtn = document.getElementById('btn-dashboard-lock');
    if (lockBtn) {
      lockBtn.textContent = this.dashboardLocked ? '🔒' : '🔓';
    }

    if (this.dashboardLocked) {
      document.querySelectorAll('.dashboard-widgets > div, .dashboard-stickies').forEach(widget => {
        widget.style.width = '';
        widget.style.height = '';
        const handles = widget.querySelectorAll('[style*="se-resize"]');
        handles.forEach(h => h.remove());
      });
    } else {
      this.initDashboardWidgets();
    }
  },

  // ── Left Rail Resize ──
  initLeftRailResize() {
    const leftRail = document.querySelector('.left-rail');
    if (!leftRail) return;
    // The collapse/expand arrow sits outside the rail (a sibling), positioned
    // with `left: <width>px` so it hugs the rail's right edge. It needs to
    // track the rail's width live, otherwise resizing the rail leaves the
    // arrow stuck at whatever width it last matched — visually "detached".
    const toggleBtn = document.getElementById('btn-toggle-left-rail');

    const handle = document.createElement('div');
    handle.id = 'left-rail-resize-handle';
    handle.style.cssText = 'position: absolute; right: -4px; top: 0; bottom: 0; width: 8px; cursor: col-resize; z-index: 100;';
    leftRail.style.position = 'relative';
    leftRail.appendChild(handle);

    if (this.settings.leftRailWidth && this.settings.leftRailWidth !== 200) {
      leftRail.style.width = this.settings.leftRailWidth + 'px';
    }
    if (toggleBtn) toggleBtn.style.left = leftRail.offsetWidth + 'px';
    this.syncWidgetsBarWidth();

    let isResizing = false;
    let startX, startWidth;

    handle.addEventListener('mousedown', (e) => {
      e.preventDefault();
      isResizing = true;
      startX = e.clientX;
      startWidth = leftRail.offsetWidth;
      document.body.style.cursor = 'col-resize';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const dx = e.clientX - startX;
      const newWidth = Math.max(120, Math.min(300, startWidth + dx));
      leftRail.style.width = newWidth + 'px';
      if (toggleBtn) toggleBtn.style.left = newWidth + 'px';
      this.syncWidgetsBarWidth();
    });

    document.addEventListener('mouseup', () => {
      if (isResizing) {
        isResizing = false;
        document.body.style.cursor = '';
        this.settings.leftRailWidth = leftRail.offsetWidth;
        this.leftRailWidth = leftRail.offsetWidth;
        this.saveSettings();
        this.syncWidgetsBarWidth();
      }
    });
  },

  // The bottom-left widget bar (calendar/clocks) is `position: fixed` so it
  // can float over the rail's bottom edge, but that means it doesn't
  // automatically track the rail's width the way a normal in-flow child
  // would. Left at a hardcoded width, resizing the rail leaves the bar
  // either short of the rail's edge or hanging past it — visible as a
  // mismatched blurry rectangle since the bar has its own backdrop-filter
  // blur. Keep it locked to the rail's actual current width instead.
  syncWidgetsBarWidth() {
    const rail = document.querySelector('.left-rail');
    const bar = document.getElementById('widgets-bar');
    if (!rail || !bar) return;
    bar.style.width = rail.offsetWidth + 'px';
  },

  // ── Event Binding ──
  bindEvents() {
    // Safety net: without this, dropping a file anywhere Electron/Chromium
    // doesn't have a specific drop-zone handler for (e.g. straight onto an
    // open note in the editor) makes the whole window navigate to that
    // file's raw contents, wiping out the entire app UI — no toolbar, no
    // save buttons, nothing, because the app itself just got replaced.
    // Specific drop zones (file tree, tree items) already call
    // preventDefault() themselves, so this only kicks in as a fallback.
    document.addEventListener('dragover', (e) => e.preventDefault());
    document.addEventListener('drop', (e) => e.preventDefault());

    // Background Style (Settings > Appearance): Gradient / Solid / Image, plus independent Glass toggle
    const bgStyleSelect = document.getElementById('background-style-select');
    if (bgStyleSelect) bgStyleSelect.addEventListener('change', (e) => this.setBackgroundStyle(e.target.value));
    const glassToggle = document.getElementById('glass-mode-toggle');
    if (glassToggle) glassToggle.addEventListener('change', () => this.toggleGlassMode());
    const bgSolidColor = document.getElementById('background-solid-color');
    const bgSolidHex = document.getElementById('background-solid-color-hex');
    if (bgSolidColor) bgSolidColor.addEventListener('input', (e) => {
      this.settings.backgroundSolidColor = e.target.value;
      if (bgSolidHex) bgSolidHex.value = e.target.value;
      this.applyBackgroundStyle();
      this._scheduleSaveSettings();
    });
    if (bgSolidHex) bgSolidHex.addEventListener('change', (e) => {
      let v = e.target.value.trim();
      if (!/^#[0-9a-fA-F]{6}$/.test(v)) { v = this.settings.backgroundSolidColor || '#0a0a14'; }
      this.settings.backgroundSolidColor = v;
      if (bgSolidColor) bgSolidColor.value = v;
      e.target.value = v;
      this.applyBackgroundStyle();
      this.saveSettings();
    });
    const exportThemeBtn = document.getElementById('btn-export-theme');
    if (exportThemeBtn) exportThemeBtn.addEventListener('click', () => this.exportCustomTheme());
    const importThemeBtn = document.getElementById('btn-import-theme');
    if (importThemeBtn) importThemeBtn.addEventListener('click', () => this.importCustomTheme());
    const chooseBgBtn = document.getElementById('btn-choose-bg-image');
    if (chooseBgBtn) chooseBgBtn.addEventListener('click', () => this.chooseBackgroundImage());
    const clearBgBtn = document.getElementById('btn-clear-bg-image');
    if (clearBgBtn) clearBgBtn.addEventListener('click', () => this.clearBackgroundImage());
    const bgBlurSlider = document.getElementById('bg-blur-slider');
    if (bgBlurSlider) bgBlurSlider.addEventListener('input', (e) => {
      this.settings.customBackgroundBlur = parseInt(e.target.value, 10) || 0;
      const label = document.getElementById('bg-blur-label');
      if (label) label.textContent = this.settings.customBackgroundBlur + 'px';
      const bgEl = document.getElementById('custom-bg-image');
      if (bgEl) bgEl.style.filter = 'blur(' + this.settings.customBackgroundBlur + 'px)';
      this._scheduleSaveSettings();
    });

    const clearRecentBtn = document.getElementById('btn-clear-recent');
    if (clearRecentBtn) clearRecentBtn.addEventListener('click', (e) => { e.stopPropagation(); this.clearRecent(); });

    // Tab row: let a normal (vertical) mouse wheel scroll it horizontally —
    // it already supports horizontal overflow, it just had no way to
    // actually reach it without a horizontal scroll gesture/scrollbar drag.
    const tabBarEl = document.getElementById('tab-bar');
    if (tabBarEl) {
      tabBarEl.addEventListener('wheel', (e) => {
        if (e.deltaY === 0) return;
        e.preventDefault();
        tabBarEl.scrollLeft += e.deltaY;
      });
    }

    // Bottom-left calendar widget: click the header row to collapse/expand
    const calToggle = document.getElementById('btn-toggle-widget-calendar');
    if (calToggle) calToggle.addEventListener('click', () => this.toggleWidgetCalendarCollapse());

    // Changelog panel (bottom-right)
    const clBtn = document.getElementById('btn-changelog');
    if (clBtn) clBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleChangelogPanel(); });
    const clClose = document.getElementById('btn-changelog-close');
    if (clClose) clClose.addEventListener('click', () => this.closeChangelogPanel());
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('changelog-panel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!panel.contains(e.target) && e.target.id !== 'btn-changelog' && !e.target.closest('#btn-changelog')) {
        this.closeChangelogPanel();
      }
    });

    // Creators panel (bottom-right)
    const crBtn = document.getElementById('btn-creators');
    if (crBtn) crBtn.addEventListener('click', (e) => { e.stopPropagation(); this.toggleCreatorsPanel(); });
    const crClose = document.getElementById('btn-creators-close');
    if (crClose) crClose.addEventListener('click', () => this.closeCreatorsPanel());
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('creators-panel');
      if (!panel || panel.classList.contains('hidden')) return;
      if (!panel.contains(e.target) && e.target.id !== 'btn-creators' && !e.target.closest('#btn-creators')) {
        this.closeCreatorsPanel();
      }
    });
    const crChaozLink = document.getElementById('creator-contact-chaoz');
    if (crChaozLink) crChaozLink.addEventListener('click', (e) => {
      e.preventDefault();
      window.xo.openExternal('https://github.com/Chaoz75');
    });

    // Update status (bottom-right)
    const upBtn = document.getElementById('btn-update-status');
    if (upBtn) upBtn.addEventListener('click', () => this.handleUpdateButtonClick());

    // Report a Bug (bottom-right) — opens a pre-filled GitHub issue
    const bugBtn = document.getElementById('btn-report-bug');
    if (bugBtn) bugBtn.addEventListener('click', () => this.reportBug());

    // Update picker modal
    const upClose = document.getElementById('btn-update-picker-close');
    if (upClose) upClose.addEventListener('click', () => this.closeUpdatePicker());
    const upOverlay = document.querySelector('#update-picker-modal .modal-overlay');
    if (upOverlay) upOverlay.addEventListener('click', () => this.closeUpdatePicker());
    const upToLatest = document.getElementById('btn-update-to-latest');
    if (upToLatest) upToLatest.addEventListener('click', () => this.chooseUpdateToLatest());
    const upOther = document.getElementById('btn-choose-other-version');
    if (upOther) upOther.addEventListener('click', () => this.chooseOtherVersion());
    const upBack = document.getElementById('btn-back-to-choice');
    if (upBack) upBack.addEventListener('click', () => this.showUpdatePickerChoiceView());

    // Setup wizard
    document.getElementById('btn-select-vault').addEventListener('click', async () => {
      const path = await window.xo.selectVault();
      if (path) {
        this.vaultPath = path;
        document.getElementById('setup-wizard').classList.add('hidden');
        document.getElementById('app').classList.remove('hidden');
        await this.loadFileTree();
        this.applySettings();
        this.showDashboard();
      }
    });

    // Window controls
    document.getElementById('btn-min').addEventListener('click', () => window.xo.minimize());
    document.getElementById('btn-max').addEventListener('click', () => window.xo.maximize());
    document.getElementById('btn-close').addEventListener('click', () => {
      const unsaved = this.openTabs.filter(t => t.unsaved);
      if (unsaved.length > 0) {
        if (confirm('You have ' + unsaved.length + ' unsaved note(s). Save before closing?')) {
          this.openTabs.forEach(async t => { if (t.unsaved) await window.xo.writeFile(t.path, t.content); });
        }
      }
      window.xo.forceClose();
    });

    window.xo.onAppClosing(() => {
      const unsaved = this.openTabs.filter(t => t.unsaved);
      if (unsaved.length > 0) {
        if (confirm('You have ' + unsaved.length + ' unsaved note(s). Save before closing?')) {
          unsaved.forEach(async t => await window.xo.writeFile(t.path, t.content));
        }
      }
      window.xo.forceClose();
    });

    // Home button
    document.getElementById('btn-home').addEventListener('click', () => {
      if (this.activeTabIndex >= 0) this._syncCurrentTabContent();
      this.showDashboard();
    });
    document.getElementById('btn-home').style.webkitAppRegion = 'no-drag';

    // Back button
    document.getElementById('btn-back-folder').addEventListener('click', () => this.goBackFolder());

    // New file/folder
    document.getElementById('btn-new-file').addEventListener('click', () => this.createNewFile());
    document.getElementById('btn-new-folder').addEventListener('click', () => this.createNewFolder());
    document.getElementById('btn-quick-note').addEventListener('click', () => this.createQuickNote());

    // Rich editor input
    document.getElementById('editor-rich').addEventListener('input', () => this.onRichEditorChange());

    // ── Links in editor: Ctrl+Click opens in default browser ──
    this._initEditorLinkHandling();

    // Click handler to ensure typing is possible after code blocks / tables at bottom of editor
    document.getElementById('editor-rich').addEventListener('click', (e) => {
      const rich = document.getElementById('editor-rich');
      const lastChild = rich.lastElementChild;
      if (!lastChild) return;

      // If user clicks in the empty space below the last element
      const lastRect = lastChild.getBoundingClientRect();
      if (e.clientY > lastRect.bottom) {
        // Always create a paragraph to type in when clicking below content
        const p = document.createElement('p');
        p.innerHTML = '<br>';
        rich.appendChild(p);
        const range = document.createRange();
        range.setStart(p, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    // Prevent wrapper div from swallowing click events — ensure clicking next to code block works
    document.getElementById('editor-rich').addEventListener('mousedown', (e) => {
      const wrapper = e.target.closest('.code-block-wrapper');
      if (wrapper && e.target === wrapper) {
        // Clicked on the wrapper itself (not on the header or pre) - place cursor after it
        e.preventDefault();
        let nextP = wrapper.nextElementSibling;
        if (!nextP || nextP.tagName !== 'P') {
          nextP = document.createElement('p');
          nextP.innerHTML = '<br>';
          wrapper.parentNode.insertBefore(nextP, wrapper.nextSibling);
        }
        const range = document.createRange();
        range.setStart(nextP, 0);
        range.collapse(true);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
      }
    });

    // Code block keydown handler
    document.getElementById('editor-rich').addEventListener('keydown', (e) => {
      const sel = window.getSelection();
      if (!sel.rangeCount) return;
      const node = sel.anchorNode;
      const pre = node?.closest ? node.closest('pre') : node?.parentElement?.closest('pre');
      if (!pre) return;

      if (e.key === 'Enter') {
        const text = pre.textContent;
        if (text.endsWith('\n\n') || (text.endsWith('\n') && sel.anchorOffset === (sel.anchorNode.textContent || '').length)) {
          e.preventDefault();
          if (pre.lastChild) {
            const lastText = pre.textContent;
            if (lastText.endsWith('\n')) {
              // Rebuild code elements without trailing newlines
              const lines = lastText.replace(/\n+$/, '').split('\n');
              const langClass = pre.querySelector('code')?.className || '';
              const lang2 = langClass.replace('language-', '');
              this._renderCodeLines(pre, lines, lang2);
            }
          }
          const p = document.createElement('p');
          p.innerHTML = '<br>';
          // Insert after the wrapper (not inside it)
          const wrapper = pre.closest('.code-block-wrapper');
          const insertAfter = wrapper || pre;
          insertAfter.parentNode.insertBefore(p, insertAfter.nextSibling);
          const range = document.createRange();
          range.setStart(p, 0);
          range.collapse(true);
          sel.removeAllRanges();
          sel.addRange(range);
          this.onRichEditorChange();
        }
      } else if (e.key === 'Backspace') {
        if (pre.textContent.trim() === '') {
          e.preventDefault();
          const wrapper = pre.closest('.code-block-wrapper');
          const blockToRemove = wrapper || pre;
          const next = blockToRemove.nextElementSibling || blockToRemove.previousElementSibling;
          blockToRemove.remove();
          if (next) {
            const range = document.createRange();
            range.setStart(next, 0);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
          }
          this.onRichEditorChange();
        }
      }
    });

    // Markdown editor input
    document.getElementById('editor-textarea').addEventListener('input', () => this.onMarkdownEditorChange());

    // Font size select
    document.getElementById('font-size-select').addEventListener('change', (e) => {
      if (this.editorMode === 'visual') {
        const rich = document.getElementById('editor-rich');
        document.execCommand('fontSize', false, '7');
        rich.querySelectorAll('font[size="7"]').forEach(el => { el.removeAttribute('size'); el.style.fontSize = e.target.value + 'px'; });
        this.onRichEditorChange();
      } else {
        this.settings.fontSize = parseInt(e.target.value);
        document.documentElement.style.setProperty('--font-editor', this.settings.fontSize + 'px');
        this.saveSettings();
      }
    });

    // Toolbar formatting buttons
    document.querySelectorAll('.toolbar-btn[data-action]').forEach(btn => {
      btn.addEventListener('click', () => this.insertFormatting(btn.dataset.action));
    });

    // Mode toggle
    document.getElementById('btn-toggle-mode').addEventListener('click', () => this.toggleEditorMode());

    // Save / Save As
    const saveBtn = document.getElementById('btn-save-file');
    if (saveBtn) saveBtn.addEventListener('click', () => this.saveCurrentFile());
    const saveAsBtn = document.getElementById('btn-save-as');
    if (saveAsBtn) saveAsBtn.addEventListener('click', () => this.openSaveAsModal('switch'));
    const saveCopyBtn = document.getElementById('btn-save-copy');
    if (saveCopyBtn) saveCopyBtn.addEventListener('click', () => this.openSaveAsModal('copy'));
    const saClose = document.getElementById('save-as-close');
    if (saClose) saClose.addEventListener('click', () => this.closeSaveAsModal());
    const saCancel = document.getElementById('save-as-cancel');
    if (saCancel) saCancel.addEventListener('click', () => this.closeSaveAsModal());
    const saConfirm = document.getElementById('save-as-confirm');
    if (saConfirm) saConfirm.addEventListener('click', () => this.confirmSaveAs());
    const saOverlay = document.querySelector('#save-as-modal .modal-overlay');
    if (saOverlay) saOverlay.addEventListener('click', () => this.closeSaveAsModal());
    const saName = document.getElementById('save-as-name');
    if (saName) saName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.confirmSaveAs();
      if (e.key === 'Escape') this.closeSaveAsModal();
    });

    // Text color input
    const tcInput = document.getElementById('text-color-input');
    if (tcInput) {
      tcInput.addEventListener('input', (e) => {
        this.textColorValue = e.target.value;
        if (this.editorMode === 'visual' && this.activeTabIndex >= 0) {
          document.execCommand('foreColor', false, this.textColorValue);
          this.onRichEditorChange();
        }
      });
    }

    // Highlight color input
    const hcInput = document.getElementById('highlight-color-input');
    if (hcInput) {
      hcInput.addEventListener('input', (e) => {
        this.highlightColorValue = e.target.value;
        if (this.editorMode === 'visual' && this.activeTabIndex >= 0) {
          document.execCommand('hiliteColor', false, this.highlightColorValue);
          this.onRichEditorChange();
        }
      });
    }

    // Search
    let searchTimer;
    document.getElementById('search-input').addEventListener('input', (e) => {
      clearTimeout(searchTimer);
      const q = e.target.value.trim();
      if (q.length < 2) {
        document.getElementById('search-results').classList.add('hidden');
        return;
      }
      searchTimer = setTimeout(() => this.performSearch(q), 300);
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.search-bar')) {
        document.getElementById('search-results').classList.add('hidden');
      }
    });

    // Settings modal
    document.getElementById('btn-settings').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.remove('hidden');
    });
    document.getElementById('settings-close').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });
    document.querySelector('#settings-modal .modal-overlay').addEventListener('click', () => {
      document.getElementById('settings-modal').classList.add('hidden');
    });

    // Settings tabs
    document.querySelectorAll('.settings-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.settings-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.settings-panel').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
      });
    });

    // Theme cards
    document.querySelectorAll('.theme-card').forEach(card => {
      card.addEventListener('click', () => {
        this.settings.theme = card.dataset.theme;
        this.saveSettings();
        this.applySettings();
      });
    });

    // Accent colors
    document.querySelectorAll('.accent-dot').forEach(dot => {
      dot.addEventListener('click', () => {
        this.settings.accent = dot.dataset.accent;
        if (this.settings.theme === 'theme-custom' && this.settings.customTheme) {
          this.settings.customTheme.accent = dot.dataset.accent;
        }
        this.saveSettings();
        this.applySettings();
      });
    });

    // ── Custom Theme Builder controls ──
    // fullApply = true re-runs the whole settings pipeline (used for
    // structural changes); otherwise use a fast path: only repaint the
    // theme on the next animation frame and save on a debounce. This is
    // what keeps the color wheel smooth while dragging.
    let ctRaf = null;
    const ctUpdate = (patch, fullApply) => {
      this.settings.customTheme = { ...(this.settings.customTheme || {}), ...patch };
      if (fullApply) {
        this.saveSettings();
        this.applySettings();
      } else {
        if (ctRaf) cancelAnimationFrame(ctRaf);
        ctRaf = requestAnimationFrame(() => { ctRaf = null; this.applyCustomTheme(); });
        this._scheduleSaveSettings();
      }
    };
    const isValidHex = (v) => /^#[0-9a-fA-F]{6}$/.test(v);
    // Solid / Gradient mode buttons
    document.querySelectorAll('.custom-bg-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => ctUpdate({ mode: btn.dataset.mode }, true));
    });
    // Gradient direction pad (8 directions)
    document.querySelectorAll('.grad-dir-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const angle = parseInt(btn.dataset.angle);
        const slider = document.getElementById('custom-angle');
        if (slider) slider.value = angle;
        const al = document.getElementById('custom-angle-label');
        if (al) al.textContent = angle + '°';
        document.querySelectorAll('.grad-dir-btn').forEach(b => b.classList.toggle('active', b === btn));
        ctUpdate({ angle: angle });
      });
    });
    // Gradient spread (how far it reaches)
    const spreadSlider = document.getElementById('custom-spread');
    if (spreadSlider) spreadSlider.addEventListener('input', (e) => {
      const sl = document.getElementById('custom-spread-label');
      if (sl) sl.textContent = e.target.value + '%';
      ctUpdate({ spread: parseInt(e.target.value) });
    });
    // Color pickers ↔ hex inputs (kept in sync)
    [['custom-color1', 'color1'], ['custom-color2', 'color2'], ['custom-accent', 'accent']].forEach(([id, key]) => {
      const picker = document.getElementById(id);
      const hex = document.getElementById(id + '-hex');
      if (picker) picker.addEventListener('input', (e) => {
        if (hex) hex.value = e.target.value;
        ctUpdate({ [key]: e.target.value });
      });
      if (hex) {
        hex.addEventListener('input', (e) => {
          let v = e.target.value.trim();
          if (v && v[0] !== '#') { v = '#' + v; e.target.value = v; }
          if (isValidHex(v)) {
            if (picker) picker.value = v;
            ctUpdate({ [key]: v });
          }
        });
        hex.addEventListener('blur', (e) => {
          if (!isValidHex(e.target.value.trim())) {
            const ct = this.settings.customTheme || {};
            e.target.value = ct[key] || (picker ? picker.value : '#000000');
          }
        });
      }
    });
    // Gradient angle
    const angleSlider = document.getElementById('custom-angle');
    if (angleSlider) angleSlider.addEventListener('input', (e) => {
      const angle = parseInt(e.target.value);
      const al = document.getElementById('custom-angle-label');
      if (al) al.textContent = angle + '°';
      document.querySelectorAll('.grad-dir-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.angle) === angle));
      ctUpdate({ angle: angle });
    });

    // Gradient intensity — fast path (direct opacity, debounced save)
    const gi = document.getElementById('gradient-intensity');
    if (gi) gi.addEventListener('input', (e) => {
      this.settings.gradientIntensity = parseFloat(e.target.value);
      const gradBg = document.getElementById('gradient-bg');
      if (gradBg) gradBg.style.opacity = this.settings.gradientIntensity;
      document.body.setAttribute('data-gradient-intensity', this.settings.gradientIntensity);
      this._scheduleSaveSettings();
    });

    // Gradient animate
    const ga = document.getElementById('gradient-animate');
    if (ga) ga.addEventListener('change', (e) => { this.settings.gradientAnimate = e.target.checked; this.saveSettings(); this.applySettings(); });

    // Brightness slider — fast path (direct filter, debounced save)
    const bs = document.getElementById('brightness-slider');
    if (bs) bs.addEventListener('input', (e) => {
      this.settings.brightness = parseFloat(e.target.value);
      const bl = document.getElementById('brightness-label');
      if (bl) bl.textContent = Math.round(this.settings.brightness * 100) + '%';
      const container = document.querySelector('.app-container');
      if (container) container.style.filter = 'brightness(' + this.settings.brightness + ')';
      this._scheduleSaveSettings();
    });

    // Project tab mode
    const ptm = document.getElementById('project-tab-mode');
    if (ptm) ptm.addEventListener('change', (e) => {
      this.settings.projectTabMode = e.target.checked;
      this.saveSettings();
      this.renderTabs();
    });

    // Font settings
    const ef = document.getElementById('editor-font-select');
    if (ef) ef.addEventListener('change', (e) => { this.settings.editorFont = e.target.value; this.saveSettings(); this.applySettings(); });
    const uf = document.getElementById('ui-font-select');
    if (uf) uf.addEventListener('change', (e) => { this.settings.uiFont = e.target.value; this.saveSettings(); this.applySettings(); });
    const uw = document.getElementById('ui-font-weight');
    if (uw) uw.addEventListener('change', (e) => { this.settings.uiFontWeight = e.target.value; this.saveSettings(); this.applySettings(); });
    const gf = document.getElementById('global-font-size');
    if (gf) gf.addEventListener('input', (e) => {
      this.settings.fontSize = parseInt(e.target.value);
      const fsl = document.getElementById('font-size-label');
      if (fsl) fsl.textContent = this.settings.fontSize + 'px';
      this.saveSettings();
      this.applySettings();
    });

    // Auto-save toggle
    const ast = document.getElementById('auto-save-toggle');
    if (ast) ast.addEventListener('change', (e) => { this.settings.autoSave = e.target.checked; this.saveSettings(); });

    // Show extensions / confirm delete
    const se = document.getElementById('show-extensions');
    if (se) se.addEventListener('change', (e) => { this.settings.showExtensions = e.target.checked; this.saveSettings(); this.loadFileTree(); });
    const cd = document.getElementById('confirm-delete');
    if (cd) cd.addEventListener('change', (e) => { this.settings.confirmDelete = e.target.checked; this.saveSettings(); });

    // Change vault
    const cv = document.getElementById('btn-change-vault');
    if (cv) cv.addEventListener('click', async () => {
      const path = await window.xo.selectVault();
      if (path) { this.vaultPath = path; await this.loadFileTree(); this.applySettings(); }
    });

    // Widget toggles
    const sct = document.getElementById('show-clocks-toggle');
    if (sct) sct.addEventListener('change', (e) => { this.settings.showClocks = e.target.checked; this.saveSettings(); this.updateWidgetVisibility(); });
    const scalt = document.getElementById('show-calendar-toggle');
    if (scalt) scalt.addEventListener('change', (e) => { this.settings.showCalendar = e.target.checked; this.saveSettings(); this.updateWidgetVisibility(); });
    const slt = document.getElementById('show-logo-toggle');
    if (slt) slt.addEventListener('change', (e) => { this.settings.showLogo = e.target.checked; this.saveSettings(); this.updateWidgetVisibility(); });

    // Clock config
    document.querySelectorAll('.clock-config').forEach(config => {
      const idx = parseInt(config.dataset.clock);
      config.querySelector('.clock-label-input').addEventListener('change', (e) => {
        this.settings.clocks[idx].label = e.target.value;
        this.saveSettings();
      });
      config.querySelector('.clock-tz-select').addEventListener('change', (e) => {
        this.settings.clocks[idx].tz = e.target.value;
        this.saveSettings();
      });
    });

    // User name input
    const unInput = document.getElementById('user-name-input');
    if (unInput) {
      unInput.addEventListener('change', (e) => {
        this.settings.userName = e.target.value;
        this.saveSettings();
        this.updateDashboardDateTime();
      });
    }

    // Time format select
    const tfs = document.getElementById('time-format-select');
    if (tfs) tfs.addEventListener('change', (e) => {
      this.settings.timeFormat = e.target.value;
      this.saveSettings();
      this.updateDashboardDateTime();
      this.updateWidgetBarClocks();
      this.renderDashboardClocks();
    });

    // UI font size slider
    const uifs = document.getElementById('ui-font-size-slider');
    if (uifs) uifs.addEventListener('input', (e) => {
      this.settings.uiFontSize = parseInt(e.target.value);
      const label = document.getElementById('ui-font-size-label');
      if (label) label.textContent = this.settings.uiFontSize + 'px';
      this.saveSettings();
      this.applySettings();
    });

    // Dashboard scale select
    const dss = document.getElementById('dashboard-scale-select');
    if (dss) dss.addEventListener('change', (e) => {
      this.settings.dashboardScale = e.target.value;
      this.saveSettings();
      this.applySettings();
    });

    // Dashboard theme select
    const dts = document.getElementById('dashboard-theme-select');
    if (dts) dts.addEventListener('change', (e) => {
      this.settings.dashboardTheme = e.target.value;
      this.saveSettings();
      this.applySettings();
    });

    // Dashboard color link toggle
    const dcl = document.getElementById('dashboard-color-link-toggle');
    if (dcl) dcl.addEventListener('change', (e) => { this.settings.dashboardColorLink = e.target.checked; this.saveSettings(); this.applySettings(); });

    // Universal dashboard color overrides
    const dashColorMap = { 'dash-color-calendar': 'dashCalendarBg', 'dash-color-kbd': 'dashKbdColor', 'dash-color-time': 'dashTimeColor', 'dash-color-welcome': 'dashWelcomeColor' };
    Object.entries(dashColorMap).forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', (e) => this.setDashColor(key, e.target.value));
    });
    document.querySelectorAll('.dash-color-reset').forEach(btn => {
      btn.addEventListener('click', () => this.resetDashColor(btn.dataset.target));
    });

    // Search bar / tab bar style
    const sbStyle = document.getElementById('search-bar-style-select');
    if (sbStyle) sbStyle.addEventListener('change', (e) => { this.settings.searchBarStyle = e.target.value; this.saveSettings(); this.applyBarStyles(); });
    const tbStyle = document.getElementById('tab-bar-style-select');
    if (tbStyle) tbStyle.addEventListener('change', (e) => { this.settings.tabBarStyle = e.target.value; this.saveSettings(); this.applyBarStyles(); });

    // Accent extras: brightness, outline color, gradient
    const abSlider = document.getElementById('accent-brightness-slider');
    if (abSlider) abSlider.addEventListener('input', (e) => {
      this.settings.accentBrightness = parseFloat(e.target.value);
      const lbl = document.getElementById('accent-brightness-label');
      if (lbl) lbl.textContent = Math.round(this.settings.accentBrightness * 100) + '%';
      this.applyAccentExtras();
      this._scheduleSaveSettings();
    });
    const aoColor = document.getElementById('accent-outline-color');
    if (aoColor) aoColor.addEventListener('input', (e) => {
      this.settings.accentOutlineColor = e.target.value;
      this.applyAccentExtras();
      this._scheduleSaveSettings();
    });
    const aoReset = document.getElementById('btn-reset-accent-outline');
    if (aoReset) aoReset.addEventListener('click', () => {
      this.settings.accentOutlineColor = null;
      this.applyAccentExtras();
      this.saveSettings();
    });
    const agToggle = document.getElementById('accent-gradient-toggle');
    if (agToggle) agToggle.addEventListener('change', (e) => {
      this.settings.accentGradientEnabled = e.target.checked;
      this.applyAccentExtras();
      this.saveSettings();
    });
    const ag2Color = document.getElementById('accent-gradient-color2');
    if (ag2Color) ag2Color.addEventListener('input', (e) => {
      this.settings.accentGradientColor2 = e.target.value;
      this.settings.accentGradientColor2Custom = true;
      this.applyAccentExtras();
      this._scheduleSaveSettings();
    });
    const ag2Reset = document.getElementById('btn-reset-accent-gradient-color2');
    if (ag2Reset) ag2Reset.addEventListener('click', () => {
      this.settings.accentGradientColor2Custom = false;
      this.applyAccentExtras();
      this.saveSettings();
    });

    // Keyboard shortcuts toggle
    const sks = document.getElementById('show-shortcuts-toggle');
    if (sks) sks.addEventListener('change', (e) => { this.settings.showKeyboardShortcuts = e.target.checked; this.saveSettings(); this.applySettings(); });

    // Auto Update toggle
    const autoUpd = document.getElementById('auto-update-toggle');
    if (autoUpd) autoUpd.addEventListener('change', (e) => { this.settings.autoUpdateEnabled = e.target.checked; this.saveSettings(); });

    // Sticky notes toggle
    const ssn = document.getElementById('show-sticky-notes-toggle');
    if (ssn) ssn.addEventListener('change', (e) => { this.settings.showStickyNotes = e.target.checked; this.saveSettings(); this.applySettings(); });

    // Sticky tasks toggle
    const sst = document.getElementById('show-sticky-tasks-toggle');
    if (sst) sst.addEventListener('change', (e) => { this.settings.showStickyTasks = e.target.checked; this.saveSettings(); this.applySettings(); });

    // Sidebar toggle buttons
    const tlr = document.getElementById('btn-toggle-left-rail');
    if (tlr) tlr.addEventListener('click', () => this.toggleLeftRail());
    const trs = document.getElementById('btn-toggle-right-sidebar');
    if (trs) trs.addEventListener('click', () => this.toggleRightSidebar());

    // Stopwatch controls
    const swStart = document.getElementById('stopwatch-start');
    if (swStart) swStart.addEventListener('click', (e) => { e.stopPropagation(); this.toggleStopwatch(); });
    const swReset = document.getElementById('stopwatch-reset');
    if (swReset) swReset.addEventListener('click', (e) => { e.stopPropagation(); this.resetStopwatch(); });

    // Stopwatch face cycling (click on the box, not buttons)
    const swBox = document.getElementById('widget-stopwatch-box');
    if (swBox) {
      swBox.addEventListener('click', (e) => {
        // Only cycle face if not clicking buttons
        if (e.target.closest('.stopwatch-btn')) return;
        this.stopwatchFaceStyle = (this.stopwatchFaceStyle + 1) % 5;
        this.saveSettings();
        this.updateStopwatchDisplay();
      });
    }

    // Logo widget click
    const logoBox = document.getElementById('widget-logo-box');
    if (logoBox) {
      logoBox.addEventListener('click', () => {
        const controls = document.querySelector('.widget-controls');
        if (controls) controls.classList.toggle('hidden');
      });
    }

    // Logo glow color
    const logoGlowColor = document.getElementById('logo-glow-color');
    if (logoGlowColor) {
      logoGlowColor.value = this.settings.logoGlowColor;
      logoGlowColor.addEventListener('change', (e) => {
        this.settings.logoGlowColor = e.target.value;
        this.saveSettings();
        this.applySettings();
      });
    }

    // Glow sync all toggle
    const glowSyncToggle = document.getElementById('glow-sync-all-toggle');
    if (glowSyncToggle) {
      glowSyncToggle.checked = this.settings.glowSyncAll;
      glowSyncToggle.addEventListener('change', (e) => {
        this.settings.glowSyncAll = e.target.checked;
        this.saveSettings();
        this.applySettings();
      });
    }

    // Glow match intensity toggle
    const glowMatchToggle = document.getElementById('glow-match-intensity-toggle');
    if (glowMatchToggle) {
      glowMatchToggle.checked = this.settings.glowMatchIntensity;
      glowMatchToggle.addEventListener('change', (e) => {
        this.settings.glowMatchIntensity = e.target.checked;
        this.saveSettings();
        this.applySettings();
      });
    }

    // Dashboard lock toggle
    const dashboardLockBtn = document.getElementById('btn-dashboard-lock');
    if (dashboardLockBtn) {
      dashboardLockBtn.textContent = this.dashboardLocked ? '🔒' : '🔓';
      dashboardLockBtn.addEventListener('click', () => this.toggleDashboardLock());
    }

    // Dashboard reset button
    const dashboardResetBtn = document.getElementById('btn-dashboard-reset');
    if (dashboardResetBtn) {
      dashboardResetBtn.addEventListener('click', () => this.resetDashboardLayout());
    }

    // Clock widget click to cycle face styles
    const clockBox = document.getElementById('widget-clock-box');
    if (clockBox) {
      clockBox.addEventListener('click', () => {
        this.clockFaceStyle = (this.clockFaceStyle + 1) % 5;
        this.saveSettings();
        this.renderAnalogClock();
      });
    }

    // Date widget click to cycle face styles
    const dateBox = document.getElementById('widget-date-box');
    if (dateBox) {
      dateBox.addEventListener('click', () => {
        this.dateFaceStyle = (this.dateFaceStyle + 1) % 5;
        this.saveSettings();
        this.updateDateWidget();
      });
    }

    // Quick Capture
    const qcBtn = document.getElementById('btn-quick-capture');
    if (qcBtn) qcBtn.addEventListener('click', () => document.getElementById('quick-capture-modal').classList.remove('hidden'));
    const qcClose = document.getElementById('quick-capture-close');
    if (qcClose) qcClose.addEventListener('click', () => document.getElementById('quick-capture-modal').classList.add('hidden'));
    const qcOverlay = document.querySelector('#quick-capture-modal .modal-overlay');
    if (qcOverlay) qcOverlay.addEventListener('click', () => document.getElementById('quick-capture-modal').classList.add('hidden'));
    const qcSave = document.getElementById('quick-capture-save-new');
    if (qcSave) qcSave.addEventListener('click', () => this.quickCaptureSaveNew());
    const qcAppend = document.getElementById('quick-capture-append');
    if (qcAppend) qcAppend.addEventListener('click', () => this.quickCaptureAppend());

    // Context menu actions
    document.querySelectorAll('#context-menu .ctx-item[data-action]').forEach(el => {
      el.addEventListener('click', () => this.handleContextAction(el.dataset.action));
    });

    // Close context menu
    document.addEventListener('click', (e) => {
      if (this.contextMenuVisible && !e.target.closest('#context-menu') && !e.target.closest('#color-picker') && !e.target.closest('#blocksize-picker') && !e.target.closest('#icon-picker')) {
        this.hideContextMenu();
      }
      // Popup pickers (color tag / block size / change icon) never closed on
      // outside click before — only by picking an option. Close them here,
      // but not when the click is the very one that opened them (a ctx-item).
      if (!e.target.closest('.ctx-item')) {
        ['color-picker', 'blocksize-picker', 'icon-picker'].forEach(id => {
          const el = document.getElementById(id);
          if (el && !el.classList.contains('hidden') && !e.target.closest('#' + id)) {
            el.classList.add('hidden');
          }
        });
      }
    });
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      ['color-picker', 'blocksize-picker', 'icon-picker', 'changelog-panel', 'creators-panel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
      });
      const results = document.getElementById('search-results');
      if (results) results.classList.add('hidden');
    });

    // Refresh button
    const refreshBtn = document.getElementById('btn-refresh-tree');
    if (refreshBtn) refreshBtn.addEventListener('click', () => {
      this.loadFileTree();
      this.updateStatusMessage('Refreshed');
    });

    // Sticky notes/tasks
    const addNoteBtn = document.getElementById('btn-add-sticky-note');
    if (addNoteBtn) addNoteBtn.addEventListener('click', () => this.addStickyNote());
    const addTaskBtn = document.getElementById('btn-add-sticky-task');
    if (addTaskBtn) addTaskBtn.addEventListener('click', () => this.addStickyTask());
    const toggleNotesBtn = document.getElementById('btn-toggle-sticky-notes');
    if (toggleNotesBtn) toggleNotesBtn.addEventListener('click', () => this.toggleDashboardPanel('sticky-notes-panel'));
    const toggleTasksBtn = document.getElementById('btn-toggle-sticky-tasks');
    if (toggleTasksBtn) toggleTasksBtn.addEventListener('click', () => this.toggleDashboardPanel('sticky-tasks-panel'));

    // External file drag-and-drop straight onto the editor (e.g. a note
    // that's currently open). Rather than doing nothing, import the
    // dropped file into the vault — same outcome as dropping it on the
    // sidebar — without disturbing the note you're currently editing.
    const editorWrapper = document.getElementById('editor-wrapper');
    if (editorWrapper) {
      editorWrapper.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }
      });
      editorWrapper.addEventListener('drop', async (e) => {
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        e.stopPropagation();
        for (const file of e.dataTransfer.files) {
          if (file.path) await window.xo.copyExternalItem(file.path, this.vaultPath);
        }
        this.updateStatusMessage('Files imported into vault — open them from the sidebar');
        await this.loadFileTree();
        this.renderSpaces();
      });
    }

    // External file drag-and-drop onto file tree
    const fileTree = document.getElementById('file-tree');
    if (fileTree) {
      fileTree.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          fileTree.classList.add('drag-root-target');
        }
      });
      fileTree.addEventListener('dragleave', (e) => {
        if (e.target === fileTree) fileTree.classList.remove('drag-root-target');
      });
      fileTree.addEventListener('drop', async (e) => {
        if (!e.dataTransfer.files || e.dataTransfer.files.length === 0) return;
        e.preventDefault();
        fileTree.classList.remove('drag-root-target');
        for (const file of e.dataTransfer.files) {
          if (file.path) {
            await window.xo.copyExternalItem(file.path, this.vaultPath);
          }
        }
        this.updateStatusMessage('Files imported');
        await this.loadFileTree();
        this.renderSpaces();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.altKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); this.openSaveAsModal('copy'); }
      else if (e.ctrlKey && e.shiftKey && (e.key === 'S' || e.key === 's')) { e.preventDefault(); this.openSaveAsModal('switch'); }
      else if (e.ctrlKey && e.key === 's') { e.preventDefault(); this.saveCurrentFile(); }
      else if (e.ctrlKey && e.key === 'n' && !e.shiftKey) { e.preventDefault(); this.createNewFile(); }
      else if (e.ctrlKey && e.shiftKey && e.key === 'N') { e.preventDefault(); document.getElementById('quick-capture-modal').classList.remove('hidden'); }
      else if (e.ctrlKey && e.key === 'p') { e.preventDefault(); document.getElementById('search-input').focus(); }
    });
  },

  async performSearch(q) {
    const results = document.getElementById('search-results');
    if (!results) return;
    try {
      const matches = await window.xo.searchFiles(q);
      if (matches.length === 0) {
        results.innerHTML = '<div class="search-result-item"><div class="search-result-name">No results found</div></div>';
      } else {
        results.innerHTML = matches.map(m =>
          '<div class="search-result-item" data-path="' + m.path + '" data-name="' + m.name + '">' +
          '<div class="search-result-name">' + m.name + '</div>' +
          '<div class="search-result-path">' + m.relativePath + '</div>' +
          (m.matchLine ? '<div class="search-result-match">' + m.matchLine + '</div>' : '') +
          '</div>'
        ).join('');
        results.querySelectorAll('.search-result-item[data-path]').forEach(el => {
          el.addEventListener('click', () => {
            this.openFile(el.dataset.path, el.dataset.name);
            results.classList.add('hidden');
          });
        });
      }
      results.classList.remove('hidden');
    } catch (e) {
      console.error('Search error:', e);
    }
  }
};

// ── Start ──
document.addEventListener('DOMContentLoaded', () => App.init());
