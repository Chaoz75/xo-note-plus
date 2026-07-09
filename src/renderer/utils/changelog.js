/* ═══════════════════════════════════════════════════════
   XO NOTE+ — CHANGELOG
   Add a new entry to the TOP of this array every time a build ships.
   Keep `version` here in sync with package.json's "version" field and
   with the installer file name (electron-builder names the installer
   from package.json automatically) — that's what ties what a user
   downloads to what they see in the in-app changelog panel.
   ═══════════════════════════════════════════════════════ */

const CHANGELOG = [
  {
    version: '1.1.0',
    date: '2026-07-09',
    changes: [
      'Added: auto-update over GitHub Releases. A new status button sits at the bottom-right — it reads "You\'re up to Date!" normally, and switches to "You Got an Update! Click to restart" once a new version has finished downloading in the background. Click it anytime to check manually, too.',
      'This needs one-time setup on the publishing side (creating the GitHub repo and running the new `npm run publish` script with a GitHub token) before it can actually find releases — see chat for the setup steps.'
    ]
  },
  {
    version: '1.0.9',
    date: '2026-07-09',
    changes: [
      'Added: a "Creators" button next to "What\'s New" at the bottom-right, opening a popover with the two people behind XO NOTE+ — Chaoz (Help Maker / Coder) and XORAYDEN (Maker), each with their photo and a contact badge (GitHub for Chaoz, Instagram for XORAYDEN). The links aren\'t live yet — hover shows "Soon" until they\'re ready.'
    ]
  },
  {
    version: '1.0.8',
    date: '2026-07-09',
    changes: [
      'Fixed: Accent Outline Color only ever showed up on hover, focus, or an active/checked state — so at rest it looked completely inert. Buttons, inputs, and floating panels (search bar, settings dropdowns, hex/save-as inputs, timezone clock fields, the icon/block-size pickers, right-click menus) now show a persistent border in your outline color all the time, not just on interaction.',
      'Verified: Accent Gradient\'s background (--accent-bg) is correctly wired on the spots that are meant to show it at rest — the primary action button, the home screen\'s "today" calendar circle, and any toggle switch that\'s turned on — so turning Accent Gradient on should now read as visibly different in those places without needing to hover.',
      'If Accent Outline, Accent Gradient, or the preset accent colors still don\'t look right after installing this update, make sure you\'re running the freshly built 1.0.8 installer (not a cached older build) and let us know exactly which screen/element still looks off.'
    ]
  },
  {
    version: '1.0.7',
    date: '2026-07-09',
    changes: [
      'Changed: Glass is back to being its own on/off toggle (like 1.0.5), instead of one of four exclusive Background Style options. Now you can turn Glass on or off with Gradient, Solid Color, or Custom Image as the background — including using a custom image with the see-through Glass panels together.',
      'Fixed: the bottom-left calendar/clocks widget bar had a hardcoded width that didn\'t track the left rail when you resized it, showing up as a mismatched blurry rectangle whenever the rail was open (and disappearing when it was closed, since the whole bar hid too). It now stays locked to the rail\'s actual width.',
      'Changed: the Accent Gradient\'s 2nd color now defaults to a close tint of your actual accent color (instead of an unrelated fixed orange), so the gradient reads as one cohesive color out of the box. You can still pick your own 2nd color, with a Reset button to go back to the auto tint. The gradient itself also blends through a mixed middle color instead of two flat color blocks.',
      '"Link Dashboard Colors to Theme" now works across all 10 dashboard themes (previously only affected Aurora+, Neon District+, Zen Garden+, Retro Terminal+, and Glass Morphic+). Classic, Midnight Command, Focus Flow, Mission Control, and Horizon now also switch to your active color theme\'s accent when the toggle is on.',
      'Reorganized Settings: Dashboard Theme, Link Dashboard Colors to Theme, Home Screen Colors, Search Bar Style, and Tab Bar Style moved from General into Appearance, so every color-related setting lives in one place. General now holds only non-color settings.'
    ]
  },
  {
    version: '1.0.6',
    date: '2026-07-09',
    changes: [
      'Fixed: on the Neon District+ theme, the vertical divider line on the home screen would drift off-center into the calendar/timezones area whenever the file-panel width slider was adjusted. It\'s now a true grid column instead of a hardcoded position, so it stays put no matter how you resize.',
      'Changed: the old "Full App Gradient" toggle and separate custom background image option are now one unified "Background Style" picker in Settings > Appearance, with four choices — Gradient, Solid Color, Custom Image, and Glass (see-through panels).',
      'Added: Home Screen Colors section in Settings > Appearance — set custom colors for the calendar background, keyboard-shortcuts text, time text, and "Welcome Back" text, applied consistently across every dashboard theme at once. "Link Dashboard Colors to Theme" now toggles this override on/off.',
      'Added: Solid vs. Gradient style options for the search bar and the tab bar, for a cleaner look independent of the active theme.',
      'Added: Accent color outline control (a separate border/outline color from the main accent fill), a brightness adjuster, and a gradient option (second color) for the accent color.',
      'Added: hovering over an option in the UI Font, UI Font Weight, or Editor Font dropdowns now shows a live preview popup near the cursor, before you click.',
      'Known issue: a reported "blur rectangle" in the bottom-left of the right sidebar is still being investigated — more detail or a screenshot will help track it down.'
    ]
  },
  {
    version: '1.0.5',
    date: '2026-07-09',
    changes: [
      'Fixed: "Welcome Back" on the home screen could get clipped off when the window wasn\'t maximized. It now scrolls into view instead of being cut off.',
      'Fixed: the sidebar collapse arrow was hardcoded to the default sidebar width, so it detached from the edge whenever you resized the sidebar. It now tracks the resize live.',
      'Fixed: the "Change Icon" picker (and the color tag / block size pickers) never closed on an outside click — only by picking an option. All three now close on outside click or Escape.',
      'Fixed: "Quick Note" in the left rail could get hidden underneath the calendar/timezone clocks widget. Quick Note now sits above that widget whenever it\'s shown, and returns to normal spacing when both are off.',
      'Added: custom background image in Settings > Appearance, with an adjustable blur (0–150).',
      'Added: "Full App Gradient" option in Settings > Appearance — makes the sidebar, titlebar, and bottom bar see-through so the gradient shows across the whole app, not just the backdrop.',
      'Added: a daily motivational quote (offline, rotates at midnight) in the right sidebar, replacing the old unused Tags panel.',
      'Added: clear-all and clear-individual controls for the Recent Notes list in the right sidebar.',
      'Added: the tab row now supports normal mouse-wheel horizontal scrolling.'
    ]
  },
  {
    version: '1.0.4',
    date: '2026-07-09',
    changes: [
      'Fixed: closing a tab could leave the editor showing the just-closed note\'s content while a different note was actually active — risked saving the wrong content into the wrong file.',
      'Fixed: the path bar and open-tabs row stayed visible over the home screen, overlapping "Welcome Back". Both now hide on the home screen and reappear when you open a note.',
      'Fixed: adding a 4th+ timezone clock to the bottom-left widget made all clocks too narrow to read, and no longer matched the calendar widget\'s width. Clocks now wrap onto a new row instead of squeezing.',
      'Fixed: word count and character count in the bottom-right were never actually updating. Both are now live as you type.',
      'Added: click the path bar above an open note to reveal that file in your OS file explorer.',
      'Added: right-click a note in the sidebar for Save, Save As, and Save a Copy — in addition to the toolbar buttons.',
      'Added: click the "Calendar" header on the bottom-left widget to collapse/expand it. The existing Settings toggle still controls showing/hiding it entirely.'
    ]
  },
  {
    version: '1.0.3',
    date: '2026-07-09',
    changes: [
      'Fixed: dragging a file from Windows Explorer onto an existing sidebar item did nothing — it now imports into that folder correctly.',
      "Fixed: dropping a file directly onto an open note could replace the entire app window with that file's raw contents. Dropping on the editor now safely imports the file into your vault instead.",
      'Added: "Save a Copy" button next to Save / Save As (Ctrl+Alt+S) — saves a duplicate without switching away from the note you’re currently editing.',
      'Added: this changelog panel, so every update is easy to track.'
    ]
  },
  {
    version: '1.0.2',
    date: '2026-03-19',
    changes: [
      'Earlier release — detailed per-version notes start with 1.0.3.'
    ]
  }
];
