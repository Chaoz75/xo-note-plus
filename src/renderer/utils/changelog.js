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
    version: '1.3.8',
    date: '2026-07-12',
    changes: [
      'Added: Ctrl+F now opens a Find bar over the editor to search within the note you have open -- shows a match count ("3 of 12"), jumps between matches with the up/down arrows or Enter/Shift+Enter, and works in all three editor views (Visual, Markdown, and Preview). Press Ctrl+F again to reselect the search box, or Escape to close it. This is a separate feature from Ctrl+P, which still searches across all your notes by title.'
    ]
  },
  {
    version: '1.3.7',
    date: '2026-07-12',
    changes: [
      'Fixed: dragging a note onto a folder in the Files panel to move it in there didn\'t work -- it looked like nothing happened, or at most the note quietly reordered itself among its siblings instead of actually moving. The drop handler was checking whether you\'d dropped in the "move into this folder" zone using a marker that had already been cleared a few lines earlier, so that check always came back false. Dragging a note onto a folder now actually moves the file into it.'
    ]
  },
  {
    version: '1.3.6',
    date: '2026-07-12',
    changes: [
      'Found the actual cause of the recurring "box near Home" reports, and it had nothing to do with tooltips: the SPACES/STARRED/RECENT headers, the Quick Note button, the left rail\'s collapse arrow, the bottom status text, and widget labels were all colored from each theme\'s own baked-in secondary-text color instead of your chosen accent -- for the default theme, that baked-in color happens to be blue. It blended into the animated gradient background (which is tinted the same way) so it went unnoticed there, but stood out clearly against a flat Solid background color, which is exactly the setup where it kept getting reported. That secondary text now always derives from your accent color, in every theme, in every background mode -- Custom Theme included.'
    ]
  },
  {
    version: '1.3.5',
    date: '2026-07-12',
    changes: [
      'Fixed for good, hopefully: Home, Search, Settings, and Quick Capture kept showing a tooltip box that overlapped the "Spaces" or "Info" headers right below/next to them, no matter how the placement math was tweaked -- the titlebar is genuinely too tight (44px tall, packed against the logo and the panels start immediately underneath) for a floating tooltip to ever fit there cleanly. Those specific buttons now show no tooltip box at all -- the icons speak for themselves -- while every other button in the app (sidebar toggles, dashboard widgets, bottom bar, settings) still gets the full accent-colored tooltip since they actually have room for one.'
    ]
  },
  {
    version: '1.3.4',
    date: '2026-07-12',
    changes: [
      'Rebuilt the hover tooltip system from scratch. The previous version wired a tooltip to each button individually and tried to dodge nearby content with increasingly complex placement rules, which ended up making things worse in places. It\'s now one simple listener for the whole app -- centered below the button, flipped above only if there\'s no room -- so it behaves the same, predictable way everywhere.',
      'Every hoverable button (window controls, sidebar collapse arrows, the What\'s New/Creators/Update bar) now highlights with the same accent color on hover instead of a mix of different grays, and the tooltip box itself is outlined in that same accent color -- hovering anything in the app now reads as one consistent hover system tied to your accent color setting.'
    ]
  },
  {
    version: '1.3.3',
    date: '2026-07-12',
    changes: [
      'Fixed: the new themed tooltip from 1.3.2 could still land right on top of nearby real content (e.g. the Home button\'s tooltip covering the "Spaces" header, or Settings/Quick Capture covering the right sidebar\'s "Info" header) -- it was always anchored below the button regardless of what was already there. It now checks the space below, right, left, and above the button and picks whichever is actually clear of the left rail, right sidebar, logo/brand, search bar, and bottom bar. In the rare corner where none of those are clear (the Home button specifically), it now shows no tooltip at all rather than covering something.'
    ]
  },
  {
    version: '1.3.2',
    date: '2026-07-11',
    changes: [
      'Found it: the "highlight box popping up in a random spot" (most noticeable hovering the Home button top-left, but it was happening on hover for buttons all over the app) was the browser\'s native tooltip. Every button uses the standard HTML tooltip attribute, which renders as a plain system-colored box positioned by the OS rather than the app -- against the dark theme, and tucked in a window corner, it read as a stray floating box rather than a tooltip. Replaced it app-wide with a themed tooltip that matches the UI and is actually anchored to the button you\'re hovering.'
    ]
  },
  {
    version: '1.3.1',
    date: '2026-07-11',
    changes: [
      'Fixed: an unexplained empty "adjustment box" could appear below the calendar/clocks row after unlocking the home dashboard. It belonged to the sticky-notes area, which is just an invisible layout wrapper around the two sticky-note boxes — it was getting a drag handle it had no real use for. That wrapper no longer gets a resize handle at all; the sticky-note boxes underneath are unaffected.',
      'The falling background particles (Settings > Appearance > Animated Background) are now bigger, brighter, and have an actual soft glow, so they read clearly as glowing snow/dots against the gradient instead of being easy to miss. If you still don\'t see them moving after this update, fully close and reopen the app (or reinstall the latest version if you\'re running a downloaded build) — the fix only takes effect once the app reloads the updated code.'
    ]
  },
  {
    version: '1.3.0',
    date: '2026-07-11',
    changes: [
      'The "Info" panel in the top-right sidebar finally does something — it now shows real stats for whichever note is open: word count, character count, an estimated reading time, and the file\'s actual created/modified dates. Updates live as you type and refreshes the modified date on save.',
      'Fully translated into all 5 supported languages.'
    ]
  },
  {
    version: '1.2.9',
    date: '2026-07-11',
    changes: [
      'Fixed: the timezone clocks widget was fully rebuilding itself from scratch every single second just to update the displayed time — that\'s what caused the clock hand/time area to visibly flicker, and it\'s also what kept recreating (and briefly re-flashing) the resize handle every second while the dashboard was unlocked. It now only updates the time text in place, leaving everything else alone.',
      'Added actual moving background particles (falling snow-like dots) behind the app for the "Animated Background" option — the gradient wash by itself shifted too slowly to read as real motion, so this is the part that\'s now visibly drifting. Follows the same on/off toggle in Settings > Appearance, and only shows when Background Style is set to Gradient.'
    ]
  },
  {
    version: '1.2.8',
    date: '2026-07-11',
    changes: [
      'Fixed: the timezone clocks widget\'s ✕ and resize handle kept disappearing shortly after unlocking the home dashboard. The clocks widget quietly rebuilds its own display every second to keep the time current, and that rebuild was wiping out the ✕/handle along with it — same underlying issue affected the calendar widget any time it re-rendered. Both now reattach their controls after every rebuild, so unlocking keeps them there for good until you lock again. This is JS-level, so it\'s fixed the same way across all 10 dashboard themes.',
      'Fixed: a Custom Theme\'s animated background wasn\'t actually animating — setting the custom gradient color was accidentally cancelling out the "oversized, panning" trick the animation relies on, so it just sat there static instead of slowly drifting like the preset themes\' backgrounds do.'
    ]
  },
  {
    version: '1.2.7',
    date: '2026-07-11',
    changes: [
      'Fixed: unlocking the home dashboard repeatedly could leave a stray resize handle ("adjustment box") sitting on a widget even after removing it with the ✕ — each unlock was quietly stacking another invisible handle on top of the last one instead of reusing it. Unlocking now only ever has exactly one handle per widget, however many times you lock and unlock.'
    ]
  },
  {
    version: '1.2.6',
    date: '2026-07-11',
    changes: [
      'Security hardening: the small popup window used for "New File," "New Folder," and "Insert Link" used to run with full Node.js access enabled inside itself. Every place that opens it only ever sends fixed text, so this wasn\'t something a note or a file could trigger — but it\'s locked down properly now (same safe settings as the rest of the app) so it can never become a problem later.',
      'No visible changes to how anything looks or works — this release is a code-level safety pass only.'
    ]
  },
  {
    version: '1.2.5',
    date: '2026-07-10',
    changes: [
      'Fixed: right-clicking the update button to browse older versions always said "No releases found," even when releases were actually published on GitHub. The check was silently treating any failed request (a rate limit, a network hiccup, etc.) the same as there truly being nothing there.',
      'The version picker now shows a specific reason when the list can\'t load (rate limited, no internet, etc.) along with a Retry button, instead of a flat "No releases found."'
    ]
  },
  {
    version: '1.2.4',
    date: '2026-07-10',
    changes: [
      'Removed the drag-to-resize handle on the left sidebar — it was the cause of the sidebar growing a little wider every time you closed and reopened it. The sidebar is a fixed width now, so that bug can\'t happen anymore.',
      'Removed the "Home Settings" section from Settings > Widgets. The calendar and clock widgets on the home dashboard are now controlled by the same 🔒/🔓 lock button as everything else on the dashboard — one lock for resizing and removing all of it.',
      'Added a ✕ button to the calendar and clock widgets on the home dashboard — while unlocked, you can remove either one entirely. "Reset dashboard layout" brings them back. Works the same across all 10 dashboard themes.',
      'Fixed the bottom-left timezone clocks not fitting inside their boxes when three are shown in a row — the time text is now sized to actually fit instead of getting silently clipped.',
      'Updated the README with the latest feature list (multi-language support, revamped search, dashboard widget improvements, and more).'
    ]
  },
  {
    version: '1.2.3',
    date: '2026-07-09',
    changes: [
      'Added Spanish, French, and German, and finished translating the entire app — right-click menus, status bar messages, confirmation dialogs, and every remaining Settings tab (Fonts, General, Widgets) now switch language along with everything else. Choose from Settings > General > Language: Auto, English, Español, Français, Deutsch, or Русский.',
      'Fixed Russian not actually translating parts of the UI — those gaps are closed, and the same fix covers all five languages going forward.',
      'Repositioned the "XO NOTE+ — XOS · XO SYSTEMS" bottom bar text to sit truly centered, no longer drifting off-center based on how much is in the corners next to it.',
      'Revamped search: the magnifying glass icon (or hitting Enter) now jumps straight to the closest match instead of just leaving the dropdown open. Search now covers every file type the app can save (not just notes), uses fuzzy closest-match ranking, and still updates live as you type.',
      'Fixed the calendar and clock widgets clipping through their own border when resized too small — they now stop at a sensible minimum size instead of letting the frame slice through the date numbers. Resizing a widget and then locking the dashboard now keeps that size instead of snapping back to default.',
      'Added a "Home Settings" section to Settings > Widgets with a dedicated lock for the calendar and clock widgets\' resize handles, separate from the general dashboard edit lock.',
      'Added an "Open..." button next to New Note in the Files panel — pick any file from your computer and it\'s copied straight into the folder you\'re viewing.',
      'Fixed right-click Save As / Save a Copy on a note: it now opens the same dialog as the toolbar, with the full ~45-format dropdown, and works correctly whether or not that note is currently open.'
    ]
  },
  {
    version: '1.2.2',
    date: '2026-07-09',
    changes: [
      'Added multi-language support: XO NOTE+ now auto-detects your Windows display language on first launch and switches the interface to match — Russian is supported alongside English for now, with more languages planned. Switch it anytime in Settings > General > Language (Auto / English / Русский), no restart needed.',
      'Core UI text updated instantly when you change languages: titlebar, sidebar, file panel, dashboard, setup wizard, Settings (all tabs), the bottom-right bar, the Save As dialog, and the first-launch welcome tour are all fully translated. Changelog history and the Creators bios stay English-only for now.',
      'Longer translated text (Russian labels run longer than English) now wraps and shrinks gracefully instead of clipping or spilling out of its container.',
      'Massively expanded the Save As / Save a Copy file-type list — from 6 formats to roughly 45, covering data & config formats (YAML, TOML, CSV, INI, SQL, and more), most major programming languages (C, C++, C#, Java, Python, JavaScript, TypeScript, Go, Rust, Swift, and more), and scripting/shell formats (Bash, Batch, PowerShell, AutoHotkey). Any format without special handling now saves safely as plain text by default.'
    ]
  },
  {
    version: '1.2.1',
    date: '2026-07-10',
    changes: [
      'Added: right-click the "Check for Updates" button in the bottom-right corner anytime to jump straight to picking an older version to install — no need to wait for an update to be available first.',
      'Fixed the GitHub split-release bug for real this time: the auto-merge script only used to touch leftover DRAFT releases, but since updates started publishing instantly (no draft step), a split could produce two fully-published releases that both claim the same version — which the old check silently ignored. It now recognizes and merges those too.',
      'Reorganized Settings > Appearance: the Custom Theme Builder now sits directly under the Theme grid, right below the "Custom" theme card it belongs to, instead of further down the page.',
      'Expanded the first-launch welcome tour: it now actually creates and opens a real note live to show off Quick Note, points out the new tab it creates, and shows where Save / Save As / Save a Copy live in the toolbar. The demo note is automatically deleted once the tour ends or is skipped, so it never clutters a new vault.'
    ]
  },
  {
    version: '1.2.0',
    date: '2026-07-09',
    changes: [
      'Fixed: checking for updates was silently failing for everyone on an installed copy of the app. The repo this app publishes to was private, which meant every update check needed a GitHub token — but the installed app never has one, so every check failed quietly and just looked like "you\'re up to date" even when it wasn\'t.',
      'The repo is now public, so update checks and downloads work with zero authentication needed. If you were stuck on an older version and this update reaches you at all, that confirms it\'s fixed — future updates should now come through normally.',
      'This does mean the source code is publicly viewable/downloadable on GitHub going forward — the LICENSE still legally protects it as All Rights Reserved, it\'s just no longer hidden from view.'
    ]
  },
  {
    version: '1.1.9',
    date: '2026-07-09',
    changes: [
      'New: a first-launch welcome tour. The very first time someone opens XO NOTE+ (right after picking a vault), a short guided tour lights up the sidebar, Quick Note, the home dashboard, Settings, Appearance, Widgets, and the bottom-right bar one at a time with a spotlight and a short explanation.',
      'Every step has both a "Next" and an "End Tutorial" button, so it can be skipped at any point. The last step says goodbye with "I hope you enjoy the app!"',
      'This only ever auto-plays once — existing users won\'t see it pop up on update, and it won\'t show again after it\'s been seen or skipped.'
    ]
  },
  {
    version: '1.1.8',
    date: '2026-07-09',
    changes: [
      'Fixed: GitHub was showing two separate "License" tabs on the repo page. This happened because both LICENSE and LICENSE.txt sat at the repo root, and GitHub treats each as its own license file.',
      'The installer-only copy of the license moved to build/LICENSE.txt so only the root-level LICENSE remains for GitHub to detect. The Windows installer\'s license-acceptance screen still shows the same "All Rights Reserved" text as before — nothing changes for people installing the app.'
    ]
  },
  {
    version: '1.1.7',
    date: '2026-07-09',
    changes: [
      'Changed: publishing an update now goes fully live on GitHub the moment PUBLISH-UPDATE.bat finishes, instead of landing as a draft that needed a manual "Publish release" click. Double-check the version and changelog entry before running the publish script, since there is no review step left before it ships.',
      'The auto-merge step (added last version) now correctly handles this — if GitHub still splits the upload across a published release and a leftover draft, the leftover\'s files are merged into the published release and the empty draft is deleted, without ever touching or removing anything already published.',
      'This is a publishing-workflow change only — nothing changes for people installing or using the app.'
    ]
  },
  {
    version: '1.1.6',
    date: '2026-07-09',
    changes: [
      'Added: PUBLISH-UPDATE.bat now automatically detects when GitHub has split a release into more than one draft (the setup .exe, .blockmap, and latest.yml landing in separate drafts) and merges everything back into a single release, deleting the leftover empty duplicate — no more manually dragging files between drafts.',
      'This is a publishing-workflow change only (scripts/merge-split-release.js) — nothing changes for people installing or using the app.'
    ]
  },
  {
    version: '1.1.5',
    date: '2026-07-09',
    changes: [
      'Added: "Report a Bug" button at the bottom-right, next to Creators and the update status — opens a pre-filled GitHub Issue.',
      'Added: Export/Import for your Custom Theme (Settings > Appearance > Custom Theme Builder) — save it to a file to share it or reuse it on another install, or load one someone shared with you.',
      'Changed: Chaoz\'s Creators card now links straight to github.com/Chaoz75 instead of showing "Soon". Role labels updated — Chaoz is now "Help Programmer", XORAYDEN is now "Founder / Creator of XO NOTE+". Removed the Instagram placeholder for XORAYDEN for now.',
      'Changed: "Quick Note" in the left rail no longer stops to ask for a title — it now creates and opens a new note instantly (auto-named "Untitled Note", "Untitled Note 2", etc.) so it\'s actually quick.',
      'Changed: moved Accent Color, Accent Brightness, Accent Outline Color, and Accent Gradient up in Settings > Appearance, right under the Theme grid, so they\'re easier to find. Added a live preview box showing your accent settings applied to a sample button, outline, and text.',
      'Fixed: in the Custom Theme Builder, picking a bright/highly saturated Color 1 (e.g. pure yellow or red) while Background Style was set to Gradient could make the app\'s box surfaces (calendar, panels, cards) collapse into one flat, nearly solid color instead of showing the intended layered depth. The shading math now works in perceptual lightness instead of raw color channels, so this stays smooth for any color choice.',
      'Fixed: the left/right sidebar collapse arrows visibly lagged behind the panel for a moment on every collapse/expand click, since the arrow was animating its position over ~200ms while the panel itself snaps instantly — the arrow now snaps into place together with the panel.'
    ]
  },
  {
    version: '1.1.4',
    date: '2026-07-09',
    changes: [
      'Added: a proprietary "All Rights Reserved" LICENSE for XO NOTE+, covering both the GitHub repo and the app itself — copyright XO Systems, 2026.',
      'Added: the Windows installer now shows a license agreement screen (you have to click "I Agree" before Setup continues).'
    ]
  },
  {
    version: '1.1.3',
    date: '2026-07-09',
    changes: [
      "Added: when an update is found, you now get to choose — \"Update to Latest Version\" (shows the changelog first, then downloads and asks to restart) or \"Choose Other Version\" (browse every released version, including older ones, and install any one of them).",
      'Added: "Auto Update" toggle in Settings > General. Turn it off to stop the automatic checks on launch and every hour — the bottom-right button still checks on demand whenever you click it.',
      'Changed: PUBLISH-UPDATE.bat now auto-fills the GitHub release notes from the matching changelog.js entry, so the release description on GitHub is written for you instead of needing to be typed in by hand.'
    ]
  },
  {
    version: '1.1.2',
    date: '2026-07-09',
    changes: [
      'Changed: PUBLISH-UPDATE.bat now creates and pushes a git tag (e.g. v1.1.2) before publishing to GitHub, to help prevent the release from getting split across multiple drafts. If it still splits occasionally, the fix is still the same: merge the missing file into one draft, delete the other, then publish.'
    ]
  },
  {
    version: '1.1.1',
    date: '2026-07-09',
    changes: [
      'Added: PUBLISH-UPDATE.bat, a one-click script next to BUILD-INSTALLER.bat that runs the GitHub publish step for you instead of typing the npm command by hand.'
    ]
  },
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
