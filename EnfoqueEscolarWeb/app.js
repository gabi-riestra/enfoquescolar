/* ============================================================
   Enfoque Escolar · aplicación web
   Todo se guarda en el navegador (localStorage). Sin cuentas,
   sin internet y sin servidores.
   ============================================================ */
(function () {
  'use strict';

  var STORAGE_KEY = 'enfoqueEscolar.data.v1';
  var TONE_COUNT = 8;
  var DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  var DAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  var DAY_INITIAL = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  var MONTHS_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  var TONE_NAMES = ['Naranja', 'Azul', 'Verde', 'Rosa', 'Turquesa', 'Amarillo', 'Violeta', 'Rojo'];
  var PHASE_LABEL = { trabajo: 'Enfoque', descanso: 'Descanso', descanso_largo: 'Descanso largo' };

  var data = null;
  var ui = {
    page: 'timeline',
    tlView: 'day',
    tlDate: startOfDay(new Date()),
    deadlineFilter: 0,
    deadlineQuery: '',
    summaryRange: 0,
    installPrompt: null,
    modal: null,
    dragging: null
  };

  /* ------------------------------------------------------------
     Utilidades generales
     ------------------------------------------------------------ */
  function pad(n) { return (n < 10 ? '0' : '') + n; }

  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

  function addDays(d, n) { var x = new Date(d.getTime()); x.setDate(x.getDate() + n); return x; }

  function startOfWeek(d) {
    var x = startOfDay(d);
    return addDays(x, -((x.getDay() + 6) % 7));
  }

  function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }

  function sameDay(a, b) {
    return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  }

  function isoDate(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }

  function parseDateOnly(value) {
    if (!value) return null;
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value));
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : startOfDay(d);
  }

  function parseStamp(value) {
    if (!value) return null;
    var d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  function parseTime(value, fallbackMinutes) {
    var m = /^(\d{1,2}):(\d{2})/.exec(String(value || ''));
    if (!m) return fallbackMinutes;
    return (Math.min(23, +m[1]) * 60) + Math.min(59, +m[2]);
  }

  function minutesText(minutes) {
    minutes = Math.max(0, minutes | 0);
    return pad(Math.floor(minutes / 60)) + ':' + pad(minutes % 60);
  }

  function stampLocal(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + 'T' +
      pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
  }

  function stampUtc(d) {
    return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
  }

  function newId() {
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint8Array(16);
      window.crypto.getRandomValues(a);
      return Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
    }
    return Date.now().toString(16) + Math.random().toString(16).slice(2, 12);
  }

  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

  function number(value, fallback) {
    var n = parseInt(value, 10);
    return isNaN(n) ? fallback : n;
  }

  function bool(value, fallback) {
    if (value === true || value === false) return value;
    return fallback;
  }

  function dateMedium(d) {
    return DAY_SHORT[d.getDay()].toLowerCase() + ' ' + d.getDate() + ' ' + MONTHS_SHORT[d.getMonth()];
  }

  function dateMediumCap(d) {
    var s = dateMedium(d);
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function dateLong(d) {
    return DAY_NAMES[d.getDay()] + ', ' + d.getDate() + ' de ' + MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
  }

  function monthTitle(d) {
    var s = MONTHS[d.getMonth()] + ' de ' + d.getFullYear();
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function fmtTimeDate(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }

  function fmtDuration(seconds) {
    seconds = Math.max(0, seconds | 0);
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + ' h' + (m ? ' ' + pad(m) + ' min' : '');
    if (m > 0) return m + ' min';
    return seconds + ' s';
  }

  function fmtClock(seconds) {
    seconds = Math.max(0, Math.round(seconds));
    var h = Math.floor(seconds / 3600);
    var m = Math.floor((seconds % 3600) / 60);
    var s = seconds % 60;
    if (h > 0) return h + ':' + pad(m) + ':' + pad(s);
    return pad(m) + ':' + pad(s);
  }

  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : many); }

  function countdown(due, now) {
    if (!due) return '';
    var diff = due.getTime() - now.getTime();
    if (diff <= 0) {
      var late = now.getTime() - due.getTime();
      var lateMin = Math.floor(late / 60000);
      if (lateMin < 1) return 'Vencido ahora';
      if (lateMin < 60) return 'Vencido hace ' + lateMin + ' min';
      var lateH = Math.floor(late / 3600000);
      if (lateH < 24) return 'Vencido hace ' + lateH + ' h';
      return 'Vencido hace ' + Math.floor(lateH / 24) + ' d';
    }
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'Vence en menos de 1 min';
    if (min < 60) return 'Vence en ' + Math.max(1, min) + ' min';
    var hours = diff / 3600000;
    if (hours < 1) return 'Vence en ' + fmtDuration(Math.floor(diff / 1000));
    if (hours < 24) return 'Vence en ' + Math.floor(hours) + ' h ' + pad(Math.floor((diff % 3600000) / 60000)) + ' min';
    var days = Math.floor(hours / 24);
    if (days < 7) return 'Vence en ' + days + ' d ' + (Math.floor(hours) % 24) + ' h';
    return 'Vence el ' + dateMediumCap(due) + ' a las ' + fmtTimeDate(due);
  }

  function countdownShort(due, now) {
    if (!due) return '';
    var diff = due.getTime() - now.getTime();
    if (diff <= 0) return 'VENCIDO';
    var min = diff / 60000;
    if (min < 60) return Math.max(1, Math.floor(min)) + ' MIN';
    var hours = diff / 3600000;
    if (hours < 24) return Math.floor(hours) + ' H ' + pad(Math.floor((diff % 3600000) / 60000)) + ' M';
    return Math.floor(hours / 24) + ' D ' + (Math.floor(hours) % 24) + ' H';
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function icon(name, cls) {
    return '<svg class="icon' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
  }

  function toneClass(tone) {
    if (tone == null || tone < 0) return '';
    return 'tone-' + (tone % TONE_COUNT);
  }

  /* ------------------------------------------------------------
     Modelo y normalización (mismo esquema que el escritorio)
     ------------------------------------------------------------ */
  function defaultSettings() {
    return {
      WorkMinutes: 25, ShortBreakMinutes: 5, LongBreakMinutes: 15, LongBreakEvery: 4,
      AutoStartBreak: true, AutoStartWork: false, Notifications: true, Sound: true
    };
  }

  function defaultTimer() {
    return {
      TaskId: '', TaskTitle: '', Subject: '', Phase: 'trabajo',
      DurationSeconds: 1500, RemainingSeconds: 1500, Running: false, Active: false,
      StartedAt: '', EndsAtUtc: '', CompletedWorkPeriods: 0
    };
  }

  function defaultData() {
    return {
      Version: 1, Theme: 'dark', Deadlines: [], Schedules: [], Activities: [],
      Sessions: [], PostIts: [], Settings: defaultSettings(), Timer: defaultTimer()
    };
  }

  function normalize(raw) {
    var out = defaultData();
    if (!raw || typeof raw !== 'object') return out;
    out.Version = 1;
    out.Theme = raw.Theme === 'light' ? 'light' : 'dark';
    out.Deadlines = Array.isArray(raw.Deadlines) ? raw.Deadlines.filter(Boolean) : [];
    out.Schedules = Array.isArray(raw.Schedules) ? raw.Schedules.filter(Boolean) : [];
    out.Activities = Array.isArray(raw.Activities) ? raw.Activities.filter(Boolean) : [];
    out.Sessions = Array.isArray(raw.Sessions) ? raw.Sessions.filter(Boolean) : [];
    out.PostIts = Array.isArray(raw.PostIts) ? raw.PostIts.filter(Boolean) : [];

    var st = raw.Settings && typeof raw.Settings === 'object' ? raw.Settings : {};
    out.Settings = {
      WorkMinutes: clamp(number(st.WorkMinutes, 25), 1, 180),
      ShortBreakMinutes: clamp(number(st.ShortBreakMinutes, 5), 1, 60),
      LongBreakMinutes: clamp(number(st.LongBreakMinutes, 15), 1, 120),
      LongBreakEvery: clamp(number(st.LongBreakEvery, 4), 1, 12),
      AutoStartBreak: bool(st.AutoStartBreak, true),
      AutoStartWork: bool(st.AutoStartWork, false),
      Notifications: bool(st.Notifications, true),
      Sound: bool(st.Sound, true)
    };

    out.Deadlines.forEach(function (d) {
      d.Id = d.Id || newId();
      d.Title = String(d.Title == null ? '' : d.Title);
      d.Subject = String(d.Subject == null ? '' : d.Subject);
      d.DueDate = String(d.DueDate == null ? '' : d.DueDate);
      d.DueTime = String(d.DueTime == null ? '' : d.DueTime);
      d.Notes = String(d.Notes == null ? '' : d.Notes);
      d.Completed = !!d.Completed;
      d.AllDay = !!d.AllDay;
      d.CompletedAt = String(d.CompletedAt == null ? '' : d.CompletedAt);
      d.CreatedAt = String(d.CreatedAt == null ? '' : d.CreatedAt);
    });

    var usedTones = [];
    out.Schedules.forEach(function (s) {
      s.Id = s.Id || newId();
      s.Title = String(s.Title == null ? '' : s.Title);
      s.Days = Array.isArray(s.Days) ? s.Days.map(function (n) { return number(n, -1); }).filter(function (n) { return n >= 0 && n <= 6; }) : [];
      s.StartTime = s.StartTime || '08:00';
      s.EndTime = s.EndTime || '10:00';
      s.IsSubject = !!s.IsSubject;
      s.SubjectTone = number(s.SubjectTone, -1);
      if (s.SubjectTone >= 0 && s.SubjectTone < TONE_COUNT) usedTones[s.SubjectTone] = true;
    });
    out.Schedules.forEach(function (s) {
      if (!s.IsSubject) return;
      if (s.SubjectTone >= 0 && s.SubjectTone < TONE_COUNT) return;
      for (var i = 0; i < TONE_COUNT; i++) {
        if (!usedTones[i]) { s.SubjectTone = i; usedTones[i] = true; return; }
      }
      s.SubjectTone = 0;
    });

    out.Activities.forEach(function (a) {
      a.Id = a.Id || newId();
      a.Title = String(a.Title == null ? '' : a.Title);
      a.Date = a.Date || isoDate(new Date());
      a.StartTime = a.StartTime || '16:00';
      a.EndTime = a.EndTime || '17:00';
      a.Subject = String(a.Subject == null ? '' : a.Subject);
      a.Notes = String(a.Notes == null ? '' : a.Notes);
      a.CreatedAt = String(a.CreatedAt == null ? '' : a.CreatedAt);
    });

    out.Sessions.forEach(function (s) {
      s.Id = s.Id || newId();
      s.Start = String(s.Start == null ? '' : s.Start);
      s.End = String(s.End == null ? '' : s.End);
      s.DurationSeconds = Math.max(0, number(s.DurationSeconds, 0));
      s.Type = s.Type || 'trabajo';
      s.TaskId = String(s.TaskId == null ? '' : s.TaskId);
      s.TaskTitle = String(s.TaskTitle == null ? '' : s.TaskTitle);
      s.Subject = String(s.Subject == null ? '' : s.Subject);
      s.Note = String(s.Note == null ? '' : s.Note);
    });

    out.PostIts.forEach(function (p) {
      p.Id = p.Id || newId();
      p.Title = String(p.Title == null ? '' : p.Title);
      p.Tone = ((number(p.Tone, 0) % TONE_COUNT) + TONE_COUNT) % TONE_COUNT;
      p.X = Math.max(0, number(p.X, 24));
      p.Y = Math.max(0, number(p.Y, 24));
      p.Items = Array.isArray(p.Items) ? p.Items.filter(Boolean) : [];
      p.Items.forEach(function (it) {
        it.Text = String(it.Text == null ? '' : it.Text);
        it.Done = !!it.Done;
      });
    });

    var t = raw.Timer && typeof raw.Timer === 'object' ? raw.Timer : {};
    out.Timer = {
      TaskId: String(t.TaskId == null ? '' : t.TaskId),
      TaskTitle: String(t.TaskTitle == null ? '' : t.TaskTitle),
      Subject: String(t.Subject == null ? '' : t.Subject),
      Phase: (t.Phase === 'descanso' || t.Phase === 'descanso_largo') ? t.Phase : 'trabajo',
      DurationSeconds: Math.max(1, number(t.DurationSeconds, out.Settings.WorkMinutes * 60)),
      RemainingSeconds: Math.max(0, number(t.RemainingSeconds, out.Settings.WorkMinutes * 60)),
      Running: !!t.Running,
      Active: !!t.Active,
      StartedAt: String(t.StartedAt == null ? '' : t.StartedAt),
      EndsAtUtc: String(t.EndsAtUtc == null ? '' : t.EndsAtUtc),
      CompletedWorkPeriods: Math.max(0, number(t.CompletedWorkPeriods, 0))
    };
    return out;
  }

  function loadData() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultData();
      return normalize(JSON.parse(raw));
    } catch (e) {
      return defaultData();
    }
  }

  function save() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      toast('No se pudo guardar. Revisa el espacio libre del navegador.', 'danger');
      return false;
    }
  }

  /* ------------------------------------------------------------
     Asignaturas y colores
     ------------------------------------------------------------ */
  function registeredSubjects() {
    var names = [];
    (data.Schedules || []).forEach(function (s) {
      if (!s || !s.IsSubject) return;
      var title = String(s.Title || '').trim();
      if (!title) return;
      for (var i = 0; i < names.length; i++) {
        if (names[i].toLocaleLowerCase() === title.toLocaleLowerCase()) return;
      }
      names.push(title);
    });
    return names;
  }

  function stableTone(text) {
    var lower = String(text || '').toLocaleLowerCase();
    var hash = 7;
    for (var i = 0; i < lower.length; i++) {
      hash = (hash * 31 + lower.charCodeAt(i)) & 0x7fffffff;
    }
    return hash % TONE_COUNT;
  }

  function toneFor(subject) {
    var clean = String(subject || '').trim();
    if (!clean) return -1;
    var blocks = data.Schedules || [];
    var i, block, title;
    for (i = 0; i < blocks.length; i++) {
      block = blocks[i];
      if (!block || !block.IsSubject) continue;
      if (String(block.Title || '').trim().toLocaleLowerCase() !== clean.toLocaleLowerCase()) continue;
      if (block.SubjectTone >= 0 && block.SubjectTone < TONE_COUNT) return block.SubjectTone;
      return stableTone(clean);
    }
    if (clean.length >= 3) {
      var lower = clean.toLocaleLowerCase();
      for (i = 0; i < blocks.length; i++) {
        block = blocks[i];
        if (!block || !block.IsSubject) continue;
        title = String(block.Title || '').trim();
        if (title.length < 3) continue;
        var t = title.toLocaleLowerCase();
        if (t.indexOf(lower) < 0 && lower.indexOf(t) < 0) continue;
        if (block.SubjectTone >= 0 && block.SubjectTone < TONE_COUNT) return block.SubjectTone;
        return stableTone(clean);
      }
    }
    return stableTone(clean);
  }

  function nextTone() {
    var used = [];
    (data.Schedules || []).forEach(function (s) {
      if (s && s.IsSubject && s.SubjectTone >= 0 && s.SubjectTone < TONE_COUNT) used[s.SubjectTone] = true;
    });
    for (var i = 0; i < TONE_COUNT; i++) if (!used[i]) return i;
    return 0;
  }

  function subjectOptions(selected) {
    var names = registeredSubjects();
    return '<option value="">Sin asignatura</option>' + names.map(function (name) {
      return '<option value="' + escapeHtml(name) + '"' + (name === selected ? ' selected' : '') + '>' + escapeHtml(name) + '</option>';
    }).join('');
  }

  /* ------------------------------------------------------------
     Tema
     ------------------------------------------------------------ */
  function applyTheme() {
    document.documentElement.setAttribute('data-theme', data.Theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', data.Theme === 'light' ? '#ffcfae' : '#120a20');
    var mobile = document.getElementById('themeBtnMobile');
    if (mobile) mobile.innerHTML = icon(data.Theme === 'light' ? 'sun' : 'moon');
    recolorSky();
  }

  function toggleTheme() {
    data.Theme = data.Theme === 'light' ? 'dark' : 'light';
    save();
    applyTheme();
    render();
  }

  /* ------------------------------------------------------------
     Cielo estrellado (deriva lenta hacia afuera, sin parpadeo)
     ------------------------------------------------------------ */
  var sky = { canvas: null, ctx: null, stars: [], w: 0, h: 0, raf: 0, dpr: 1 };

  function skyPalette() {
    if (data.Theme === 'light') {
      return ['#c2410c', '#be123c', '#9d174d', '#7e22ce', '#a16207', '#b45309'];
    }
    return ['#f8fafc', '#ede9fe', '#fce7f3', '#dbeafe', '#fef3c7', '#ddd6fe'];
  }

  function recolorSky() {
    var palette = skyPalette();
    sky.stars.forEach(function (s) { s.color = palette[s.colorIndex % palette.length]; });
  }

  function resizeSky() {
    if (!sky.canvas) return;
    sky.dpr = Math.min(2, window.devicePixelRatio || 1);
    sky.w = window.innerWidth;
    sky.h = window.innerHeight;
    sky.canvas.width = Math.round(sky.w * sky.dpr);
    sky.canvas.height = Math.round(sky.h * sky.dpr);
    sky.canvas.style.width = sky.w + 'px';
    sky.canvas.style.height = sky.h + 'px';
    if (sky.ctx) sky.ctx.setTransform(sky.dpr, 0, 0, sky.dpr, 0, 0);
  }

  function initSky() {
    sky.canvas = document.getElementById('sky');
    if (!sky.canvas) return;
    sky.ctx = sky.canvas.getContext('2d');
    resizeSky();
    var count = Math.max(90, Math.min(190, Math.round((sky.w * sky.h) / 11000)));
    var maxR = Math.sqrt(sky.w * sky.w + sky.h * sky.h) / 2 + 40;
    for (var i = 0; i < count; i++) {
      sky.stars.push({
        angle: Math.random() * Math.PI * 2,
        radius: Math.random() * maxR,
        speed: 0.02 + Math.random() * 0.07,
        size: 0.45 + Math.random() * 1.25,
        colorIndex: Math.floor(Math.random() * 6),
        alpha: 0.35 + Math.random() * 0.55
      });
    }
    recolorSky();
    window.addEventListener('resize', function () { resizeSky(); }, { passive: true });
    drawSky();
  }

  function drawSky() {
    if (!sky.ctx) return;
    var ctx = sky.ctx;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var maxR = Math.sqrt(sky.w * sky.w + sky.h * sky.h) / 2 + 40;
    var cx = sky.w / 2;
    var cy = sky.h / 2;
    ctx.clearRect(0, 0, sky.w, sky.h);
    for (var i = 0; i < sky.stars.length; i++) {
      var s = sky.stars[i];
      if (!reduced) {
        s.radius += s.speed;
        if (s.radius > maxR) {
          s.radius = Math.random() * maxR * 0.35;
          s.angle = Math.random() * Math.PI * 2;
        }
      }
      var x = cx + Math.cos(s.angle) * s.radius;
      var y = cy + Math.sin(s.angle) * s.radius * 0.92;
      if (x < -4 || x > sky.w + 4 || y < -4 || y > sky.h + 4) continue;
      ctx.globalAlpha = s.alpha;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (!reduced) sky.raf = window.requestAnimationFrame(drawSky);
  }

  /* ------------------------------------------------------------
     Avisos y modales
     ------------------------------------------------------------ */
  function toast(message, type) {
    var root = document.getElementById('toastRoot');
    if (!root) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'success');
    el.innerHTML = icon(type === 'danger' ? 'alert' : type === 'warning' ? 'alert' : 'check') + '<span>' + escapeHtml(message) + '</span>';
    root.appendChild(el);
    window.setTimeout(function () {
      el.classList.add('out');
      window.setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
    }, 3200);
  }

  function openModal(options) {
    closeModal();
    var root = document.getElementById('modalRoot');
    var wide = options.wide ? ' wide' : options.narrow ? ' narrow' : '';
    root.innerHTML =
      '<div class="modal-backdrop" data-modal-backdrop>' +
        '<div class="modal' + wide + '" role="dialog" aria-modal="true" aria-label="' + escapeHtml(options.title || 'Ventana') + '">' +
          '<div class="modal-head">' +
            '<div>' +
              '<h2>' + escapeHtml(options.title || '') + '</h2>' +
              (options.subtitle ? '<p>' + escapeHtml(options.subtitle) + '</p>' : '') +
            '</div>' +
            '<button type="button" class="icon-btn" data-modal-close title="Cerrar">' + icon('x') + '</button>' +
          '</div>' +
          (options.body || '') +
        '</div>' +
      '</div>';
    var backdrop = root.querySelector('[data-modal-backdrop]');
    var modal = root.querySelector('.modal');
    ui.modal = { backdrop: backdrop, modal: modal, onClose: options.onClose || null, resolve: options.resolve || null };
    backdrop.addEventListener('click', function (e) {
      if (e.target === backdrop) closeModal();
    });
    var focusable = modal.querySelector('input:not([type="hidden"]), select, textarea, button');
    if (focusable) window.setTimeout(function () { try { focusable.focus(); } catch (e) {} }, 40);
    return modal;
  }

  function closeModal(result) {
    if (!ui.modal) return;
    var m = ui.modal;
    ui.modal = null;
    var root = document.getElementById('modalRoot');
    root.innerHTML = '';
    if (m.onClose) m.onClose(result);
    if (m.resolve) m.resolve(result === undefined ? null : result);
  }

  function askConfirm(options) {
    return new Promise(function (resolve) {
      openModal({
        title: options.title || 'Confirmar',
        narrow: true,
        resolve: resolve,
        body:
          '<div class="modal-body">' +
            '<p class="confirm-text">' + options.message + '</p>' +
          '</div>' +
          '<div class="modal-foot">' +
            '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
            '<button type="button" class="btn ' + (options.danger ? 'btn-danger' : 'btn-primary') + '" data-confirm>' + escapeHtml(options.confirmText || 'Aceptar') + '</button>' +
          '</div>'
      });
      var root = document.getElementById('modalRoot');
      root.querySelector('[data-confirm]').addEventListener('click', function () { closeModal(true); });
    });
  }

  function formError(message) {
    var el = document.querySelector('.form-error');
    if (el) el.textContent = message || '';
  }

  /* ------------------------------------------------------------
     Reloj de la cabecera
     ------------------------------------------------------------ */
  function tickClock() {
    var now = new Date();
    var time = document.getElementById('clockTime');
    var date = document.getElementById('clockDate');
    if (time) time.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    if (date) date.textContent = DAY_NAMES[now.getDay()] + ' ' + now.getDate() + ' ' + MONTHS_SHORT[now.getMonth()];
    tickTimerUi();
  }

  /* ------------------------------------------------------------
     Estructura de páginas
     ------------------------------------------------------------ */
  var PAGE_META = {
    timeline: ['Línea de tiempo', 'Tus entregas, horarios y actividades en un solo lugar'],
    deadlines: ['Entregas', 'Tareas con fecha límite y su cuenta regresiva'],
    schedules: ['Horarios', 'Bloques fijos que se repiten cada semana'],
    postits: ['Pendientes generales', 'Un tablón de notas para lo que no tiene fecha'],
    summary: ['Resumen', 'Cuánto has estudiado y en qué se fue tu tiempo'],
    settings: ['Ajustes', 'Personaliza el pomodoro, el tema y tus respaldos']
  };

  function setPage(page) {
    if (!PAGE_META[page]) page = 'timeline';
    ui.page = page;
    try { history.replaceState(null, '', '#' + page); } catch (e) {}
    render();
    var view = document.getElementById('view');
    if (view) view.scrollTop = 0;
  }

  function render() {
    var meta = PAGE_META[ui.page] || PAGE_META.timeline;
    var title = document.getElementById('pageTitle');
    var subtitle = document.getElementById('pageSubtitle');
    if (title) title.textContent = meta[0];
    if (subtitle) subtitle.textContent = meta[1];
    document.querySelectorAll('[data-nav]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-nav') === ui.page);
    });

    var html = '';
    if (ui.page === 'timeline') html = renderTimeline();
    else if (ui.page === 'deadlines') html = renderDeadlines();
    else if (ui.page === 'schedules') html = renderSchedules();
    else if (ui.page === 'postits') html = renderPostIts();
    else if (ui.page === 'summary') html = renderSummary();
    else if (ui.page === 'settings') html = renderSettings();

    var view = document.getElementById('view');
    if (view) view.innerHTML = '<div class="view-inner">' + html + '</div>';
    renderTimerCard();
    if (ui.page === 'postits') bindPostItDrag();
  }

  /* ------------------------------------------------------------
     Línea de tiempo
     ------------------------------------------------------------ */
  function deadlineDue(d) {
    var date = parseDateOnly(d.DueDate);
    if (!date) return null;
    var minutes = d.AllDay ? 23 * 60 + 59 : parseTime(d.DueTime, 23 * 60 + 59);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(minutes / 60), minutes % 60, 0, 0);
  }

  function schedulesOn(date) {
    return (data.Schedules || []).filter(function (s) {
      return s.Days && s.Days.indexOf(date.getDay()) >= 0;
    });
  }

  function deadlinesOn(date) {
    return (data.Deadlines || []).filter(function (d) {
      var due = deadlineDue(d);
      return due && sameDay(due, date);
    });
  }

  function activitiesOn(date) {
    return (data.Activities || []).filter(function (a) {
      var d = parseDateOnly(a.Date);
      return d && sameDay(d, date);
    });
  }

  function activeDeadlines() {
    return (data.Deadlines || []).filter(function (d) { return !d.Completed; }).sort(function (a, b) {
      var da = deadlineDue(a), db = deadlineDue(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }

  function eventTone(subject, fallback) {
    var t = toneFor(subject);
    return t >= 0 ? t : fallback;
  }

  function timelineRange() {
    var d = ui.tlDate;
    if (ui.tlView === 'day') {
      return {
        title: dateLong(d),
        sub: sameDay(d, new Date()) ? 'Hoy' : DAY_NAMES[d.getDay()]
      };
    }
    if (ui.tlView === 'week') {
      var mon = startOfWeek(d), sun = addDays(mon, 6);
      var label = 'Semana del ' + dateMedium(mon) + ' al ' + dateMedium(sun);
      return { title: label.charAt(0).toUpperCase() + label.slice(1), sub: 'Semana' };
    }
    return { title: monthTitle(d), sub: 'Mes' };
  }

  function renderTimeline() {
    var range = timelineRange();
    var strip = activeDeadlines();
    var html = '<div class="tl-toolbar">' +
      '<div class="segmented">' +
        '<button type="button" data-tlview="day" class="' + (ui.tlView === 'day' ? 'active' : '') + '">Día</button>' +
        '<button type="button" data-tlview="week" class="' + (ui.tlView === 'week' ? 'active' : '') + '">Semana</button>' +
        '<button type="button" data-tlview="month" class="' + (ui.tlView === 'month' ? 'active' : '') + '">Mes</button>' +
      '</div>' +
      '<button type="button" class="icon-btn" data-tlprev title="Anterior">' + icon('chevron-left') + '</button>' +
      '<div class="tl-range">' + escapeHtml(range.title) + '<small>' + escapeHtml(range.sub) + '</small></div>' +
      '<button type="button" class="icon-btn" data-tlnext title="Siguiente">' + icon('chevron-right') + '</button>' +
      '<button type="button" class="btn btn-secondary btn-sm" data-tltoday>Hoy</button>' +
      '<div class="spacer"></div>' +
      '<button type="button" class="btn btn-secondary" data-new-activity>' + icon('plus') + 'Actividad</button>' +
      '<button type="button" class="btn btn-primary" data-new-deadline>' + icon('plus') + 'Nueva entrega</button>' +
    '</div>';

    if (strip.length) {
      html += '<div class="active-strip">';
      strip.slice(0, 8).forEach(function (d) {
        var due = deadlineDue(d);
        var tone = eventTone(d.Subject, 7);
        html += '<div class="deadline-pill ' + toneClass(tone) + '" data-edit-deadline="' + escapeHtml(d.Id) + '">' +
          '<div class="dp-main">' +
            '<div class="dp-title">' + escapeHtml(d.Title) + '</div>' +
            '<div class="dp-sub">' + escapeHtml(d.Subject || 'Sin asignatura') + ' · ' + (d.AllDay ? 'Todo el día' : (due ? fmtTimeDate(due) : 'Sin fecha')) + '</div>' +
          '</div>' +
          '<div class="dp-time">' + escapeHtml(due ? countdownShort(due, new Date()) : '') + '</div>' +
          '<button type="button" class="dp-play" data-pomodoro="' + escapeHtml(d.Id) + '" title="Estudiar con pomodoro">' + icon('play') + '</button>' +
        '</div>';
      });
      html += '</div>';
    }

    if (ui.tlView === 'day') html += renderDayView(ui.tlDate);
    else if (ui.tlView === 'week') html += renderWeekView(ui.tlDate);
    else html += renderMonthView(ui.tlDate);
    return html;
  }

  function hourLabels() {
    var out = '';
    for (var h = 6; h <= 24; h += 2) {
      var pct = ((h - 6) / 18) * 100;
      var style = 'left:' + pct + '%;' + (h === 24 ? 'transform:translateX(-100%);' : '');
      out += '<span class="hour-label" style="' + style + '">' + pad(h) + ':00</span>';
    }
    return out;
  }

  function blockGeometry(startMin, endMin) {
    var a = clamp(startMin, 360, 1440);
    var b = clamp(endMin, 360, 1440);
    if (b <= a) b = Math.min(1440, a + 20);
    var left = ((a - 360) / 1080) * 100;
    var width = ((b - a) / 1080) * 100;
    return 'left:' + left.toFixed(2) + '%;width:' + Math.max(1.4, width).toFixed(2) + '%;';
  }

  function assignLanes(items) {
    var laneEnds = [];
    items.forEach(function (it) {
      var lane = -1;
      for (var i = 0; i < laneEnds.length; i++) {
        if (laneEnds[i] <= it.startMin) { lane = i; break; }
      }
      if (lane < 0) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = it.endMin;
      it.lane = lane;
    });
    return Math.max(1, laneEnds.length);
  }

  function renderDayView(date) {
    var schedules = schedulesOn(date).map(function (s) {
      return {
        kind: 'schedule', id: s.Id, title: s.Title,
        startMin: parseTime(s.StartTime, 8 * 60), endMin: parseTime(s.EndTime, 10 * 60),
        subject: s.IsSubject ? s.Title : '', tone: s.IsSubject ? (s.SubjectTone >= 0 ? s.SubjectTone : stableTone(s.Title)) : eventTone(s.Title, 4)
      };
    }).sort(function (a, b) { return a.startMin - b.startMin; });

    var activities = activitiesOn(date).map(function (a) {
      return {
        kind: 'activity', id: a.Id, title: a.Title,
        startMin: parseTime(a.StartTime, 16 * 60), endMin: parseTime(a.EndTime, 17 * 60),
        subject: a.Subject || '', tone: eventTone(a.Subject || a.Title, 4)
      };
    }).sort(function (a, b) { return a.startMin - b.startMin; });

    var timedDeadlines = deadlinesOn(date).filter(function (d) { return !d.AllDay; }).map(function (d) {
      var due = deadlineDue(d);
      return {
        kind: 'deadline', id: d.Id, title: d.Title, completed: d.Completed,
        startMin: due ? due.getHours() * 60 + due.getMinutes() : 23 * 60 + 59,
        endMin: (due ? due.getHours() * 60 + due.getMinutes() : 23 * 60 + 59) + 30,
        subject: d.Subject || '', tone: eventTone(d.Subject, 7)
      };
    }).sort(function (a, b) { return a.startMin - b.startMin; });

    var allDay = deadlinesOn(date).filter(function (d) { return d.AllDay; });

    var scheduleLanes = assignLanes(schedules);
    var deadlineLanes = assignLanes(timedDeadlines);
    var activityLanes = assignLanes(activities);

    var html = '<div class="card flush" style="padding:0;">' +
      '<div class="day-scroll"><div class="day-board">' +
        '<div class="day-head"><div class="head-label"></div><div class="head-track">' + hourLabels() + '</div></div>' +
        '<div class="allday-band"><div class="row-label"><strong>Todo el día</strong><span>' + plural(allDay.length, 'entrega', 'entregas') + '</span></div><div class="allday-track">';

    if (allDay.length) {
      allDay.forEach(function (d) {
        html += '<button type="button" class="allday-chip ' + toneClass(eventTone(d.Subject, 7)) + '" data-edit-deadline="' + escapeHtml(d.Id) + '"><span class="dot"></span>' + escapeHtml(d.Title) + '</button>';
      });
    } else {
      html += '<span class="subtle small">Sin entregas de todo el día</span>';
    }
    html += '</div></div>';

    html += dayRow('Asignaturas', plural(schedules.length, 'bloque', 'bloques'), 1, schedules, scheduleLanes, 76);
    html += dayRow('Entregas', plural(timedDeadlines.length, 'entrega', 'entregas'), 7, timedDeadlines, deadlineLanes, 42);
    html += dayRow('Actividades', plural(activities.length, 'actividad', 'actividades'), 4, activities, activityLanes, 76);

    html += '</div></div></div>';

    var now = new Date();
    if (sameDay(date, now)) {
      var nowPct = ((now.getHours() * 60 + now.getMinutes()) - 360) / 1080 * 100;
      if (nowPct >= 0 && nowPct <= 100) {
        html += '<div class="small muted" style="margin-top:10px;text-align:right;">' +
          'Ahora: ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + '</div>';
      }
    }
    return html;
  }

  function dayRow(label, hint, tone, items, lanes, blockHeight) {
    var minHeight = Math.max(88, 7 + lanes * (blockHeight + 6));
    var html = '<div class="day-row" style="min-height:' + minHeight + 'px;">' +
      '<div class="row-label ' + toneClass(tone) + '"><span class="rl-dot"></span><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(hint) + '</span></div>' +
      '<div class="row-track">';
    if (!items.length) {
      html += '<div class="subtle small" style="position:absolute;left:12px;top:50%;transform:translateY(-50%);">Sin bloques</div>';
    }
    items.forEach(function (it) {
      var top = 7 + (it.lane || 0) * (blockHeight + 6);
      var geom = blockGeometry(it.startMin, it.endMin);
      var compact = blockHeight < 50;
      var cls = 'tl-block ' + toneClass(it.tone) + (it.kind === 'deadline' ? ' deadline' : '') +
        (it.completed ? ' done' : '') + (compact ? ' compact' : '');
      var action = it.kind === 'deadline' ? 'data-edit-deadline' : it.kind === 'activity' ? 'data-edit-activity' : 'data-edit-schedule';
      var sub = it.kind === 'deadline'
        ? (it.subject || 'Entrega') + ' · ' + minutesText(it.startMin)
        : minutesText(it.startMin) + ' – ' + minutesText(it.endMin);
      html += '<button type="button" class="' + cls + '" style="' + geom + 'top:' + top + 'px;height:' + (compact ? 34 : 68) + 'px;" ' + action + '="' + escapeHtml(it.id) + '">' +
        '<div class="tb-title">' + escapeHtml(it.title) + '</div>' +
        '<div class="tb-sub">' + escapeHtml(sub) + '</div>' +
        (it.subject && it.kind !== 'deadline' ? '<div class="tb-subject">' + escapeHtml(it.subject) + '</div>' : '') +
      '</button>';
    });
    html += '</div></div>';
    return html;
  }

  function renderWeekView(date) {
    var monday = startOfWeek(date);
    var today = new Date();
    var html = '<div class="week-grid">';
    for (var i = 0; i < 7; i++) {
      var day = addDays(monday, i);
      var schedules = schedulesOn(day);
      var activities = activitiesOn(day);
      var deadlines = deadlinesOn(day);
      var allDay = deadlines.filter(function (d) { return d.AllDay; });
      var timed = deadlines.filter(function (d) { return !d.AllDay; });
      var events = [];

      schedules.forEach(function (s) {
        events.push({
          kind: 'schedule', id: s.Id, title: s.Title, sub: s.StartTime + ' – ' + s.EndTime,
          startMin: parseTime(s.StartTime, 480), tone: s.IsSubject ? (s.SubjectTone >= 0 ? s.SubjectTone : stableTone(s.Title)) : eventTone(s.Title, 4)
        });
      });
      activities.forEach(function (a) {
        events.push({
          kind: 'activity', id: a.Id, title: a.Title, sub: a.StartTime + ' – ' + a.EndTime,
          startMin: parseTime(a.StartTime, 960), tone: eventTone(a.Subject || a.Title, 4)
        });
      });
      timed.forEach(function (d) {
        var due = deadlineDue(d);
        events.push({
          kind: 'deadline', id: d.Id, title: d.Title, sub: due ? fmtTimeDate(due) : '',
          startMin: due ? due.getHours() * 60 + due.getMinutes() : 1439, tone: eventTone(d.Subject, 7), completed: d.Completed
        });
      });
      events.sort(function (a, b) { return a.startMin - b.startMin; });

      var isToday = sameDay(day, today);
      var weekend = day.getDay() === 0 || day.getDay() === 6;
      html += '<div class="week-day' + (isToday ? ' today' : '') + (weekend ? ' weekend' : '') + '">' +
        '<div class="week-day-head" data-goday="' + isoDate(day) + '" title="Ver el día">' +
          '<span class="wd-name">' + DAY_SHORT[day.getDay()] + '</span><span class="wd-num">' + day.getDate() + '</span>' +
        '</div>';
      if (allDay.length) {
        html += '<div class="week-allday">' + allDay.map(function (d) {
          return '<button type="button" class="allday-chip ' + toneClass(eventTone(d.Subject, 7)) + '" data-edit-deadline="' + escapeHtml(d.Id) + '"><span class="dot"></span>' + escapeHtml(d.Title) + '</button>';
        }).join('') + '</div>';
      }
      html += '<div class="week-events">';
      if (!events.length && !allDay.length) {
        html += '<div class="week-empty">Día despejado</div>';
      } else {
        events.slice(0, 8).forEach(function (ev) {
          var action = ev.kind === 'deadline' ? 'data-edit-deadline' : ev.kind === 'activity' ? 'data-edit-activity' : 'data-edit-schedule';
          html += '<button type="button" class="week-event ' + toneClass(ev.tone) + (ev.completed ? ' done' : '') + '" ' + action + '="' + escapeHtml(ev.id) + '">' +
            '<span class="we-time">' + escapeHtml(ev.sub) + '</span>' +
            '<span class="we-title">' + escapeHtml(ev.title) + '</span>' +
          '</button>';
        });
        if (events.length > 8) html += '<div class="week-empty" style="padding:2px;">+' + (events.length - 8) + ' más</div>';
      }
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function monthEventsForDay(day) {
    var list = [];
    schedulesOn(day).forEach(function (s) {
      list.push({ kind: 'schedule', id: s.Id, title: s.Title, tone: s.IsSubject ? (s.SubjectTone >= 0 ? s.SubjectTone : stableTone(s.Title)) : eventTone(s.Title, 4), time: parseTime(s.StartTime, 480) });
    });
    deadlinesOn(day).forEach(function (d) {
      var due = deadlineDue(d);
      list.push({ kind: 'deadline', id: d.Id, title: d.Title, tone: eventTone(d.Subject, 7), completed: d.Completed, time: due ? due.getHours() * 60 + due.getMinutes() : 1439 });
    });
    activitiesOn(day).forEach(function (a) {
      list.push({ kind: 'activity', id: a.Id, title: a.Title, tone: eventTone(a.Subject || a.Title, 4), time: parseTime(a.StartTime, 960) });
    });
    list.sort(function (a, b) { return a.time - b.time; });
    return list;
  }

  function renderMonthView(date) {
    var first = startOfMonth(date);
    var gridStart = startOfWeek(first);
    var today = new Date();
    var html = '<div class="month-scroll"><div class="month-grid">';
    var i;
    for (i = 0; i < 7; i++) html += '<div class="month-weekday">' + DAY_SHORT[(i + 1) % 7] + '</div>';

    for (i = 0; i < 42; i++) {
      var day = addDays(gridStart, i);
      var events = monthEventsForDay(day);
      var other = day.getMonth() !== date.getMonth();
      var isToday = sameDay(day, today);
      html += '<div class="month-cell' + (other ? ' other' : '') + (isToday ? ' today' : '') + '" data-goday="' + isoDate(day) + '">' +
        '<div class="mc-num">' + day.getDate() + '</div>';
      events.slice(0, 3).forEach(function (ev) {
        html += '<div class="month-event ' + toneClass(ev.tone) + '"><span class="dot"></span>' + escapeHtml(ev.title) + '</div>';
      });
      if (events.length > 3) html += '<div class="month-more">+' + (events.length - 3) + ' más</div>';
      html += '</div>';
    }
    html += '</div></div>';
    return html;
  }

  /* ------------------------------------------------------------
     Entregas
     ------------------------------------------------------------ */
  function renderDeadlines() {
    var active = data.Deadlines.filter(function (d) { return !d.Completed; });
    var done = data.Deadlines.filter(function (d) { return d.Completed; });
    var html = '<div class="list-toolbar">' +
      '<div class="segmented">' +
        '<button type="button" data-dfilter="0" class="' + (ui.deadlineFilter === 0 ? 'active' : '') + '">Todas</button>' +
        '<button type="button" data-dfilter="1" class="' + (ui.deadlineFilter === 1 ? 'active' : '') + '">Activas</button>' +
        '<button type="button" data-dfilter="2" class="' + (ui.deadlineFilter === 2 ? 'active' : '') + '">Completadas</button>' +
      '</div>' +
      '<div class="search-box grow">' + icon('search') +
        '<input type="search" id="deadlineSearch" placeholder="Buscar por título, materia o nota…" value="' + escapeHtml(ui.deadlineQuery) + '">' +
      '</div>' +
      '<button type="button" class="btn btn-primary" data-new-deadline>' + icon('plus') + 'Nueva entrega</button>' +
    '</div>' +
    '<div class="row wrap" style="margin-bottom:12px;">' +
      '<span class="small muted" id="deadlineSummary">' + plural(active.length, 'entrega activa', 'entregas activas') + ' · ' + done.length + ' completadas</span>' +
    '</div>' +
    '<div class="deadline-list" id="deadlineList">' + deadlineListHtml() + '</div>';
    return html;
  }

  function filteredDeadlines() {
    var q = (ui.deadlineQuery || '').toLocaleLowerCase().trim();
    var list = data.Deadlines.filter(function (d) {
      if (ui.deadlineFilter === 1 && d.Completed) return false;
      if (ui.deadlineFilter === 2 && !d.Completed) return false;
      if (!q) return true;
      return (d.Title + ' ' + d.Subject + ' ' + d.Notes).toLocaleLowerCase().indexOf(q) >= 0;
    });
    return list.sort(function (a, b) {
      if (a.Completed !== b.Completed) return a.Completed ? 1 : -1;
      if (a.Completed) {
        var ca = parseStamp(a.CompletedAt), cb = parseStamp(b.CompletedAt);
        return (cb ? cb.getTime() : 0) - (ca ? ca.getTime() : 0);
      }
      var da = deadlineDue(a), db = deadlineDue(b);
      if (!da && !db) return 0;
      if (!da) return 1;
      if (!db) return -1;
      return da - db;
    });
  }

  function deadlineListHtml() {
    var list = filteredDeadlines();
    var now = new Date();
    if (!list.length) {
      return '<div class="card"><div class="empty-state">' +
        '<div class="es-icon">' + icon('deadline') + '</div>' +
        '<strong>No hay entregas para mostrar</strong>' +
        '<p>Crea una entrega con fecha y hora para verla aquí y en la línea de tiempo.</p>' +
        '<div class="row"><button type="button" class="btn btn-primary" data-new-deadline>' + icon('plus') + 'Nueva entrega</button></div>' +
      '</div></div>';
    }
    var html = '';
    var showingCompletedSep = false;
    list.forEach(function (d) {
      if (d.Completed && !showingCompletedSep && ui.deadlineFilter !== 2) {
        html += '<div class="completed-sep">Completadas</div>';
        showingCompletedSep = true;
      }
      html += deadlineCard(d, now);
    });
    return html;
  }

  function deadlineCard(d, now) {
    var due = deadlineDue(d);
    var tone = eventTone(d.Subject, 7);
    var overdue = !d.Completed && due && due < now;
    var when = '';
    if (d.Completed) {
      var completed = parseStamp(d.CompletedAt);
      when = completed ? 'Completada el ' + dateMediumCap(completed) : 'Completada';
    } else if (due) {
      when = (d.AllDay ? 'Todo el día · ' : '') + dateMediumCap(due) + (d.AllDay ? '' : ' a las ' + fmtTimeDate(due));
    } else {
      when = 'Sin fecha';
    }
    var count = d.Completed ? '' : (due ? countdownShort(due, now) : 'SIN FECHA');
    return '<div class="deadline-card ' + toneClass(tone) + (d.Completed ? ' done' : '') + (overdue ? ' overdue' : '') + '">' +
      '<div class="dc-stripe"></div>' +
      '<div class="dc-main">' +
        '<div class="dc-top">' +
          '<span class="dc-title">' + escapeHtml(d.Title) + '</span>' +
          (d.Subject ? '<span class="chip tone">' + escapeHtml(d.Subject) + '</span>' : '') +
          (d.AllDay ? '<span class="badge muted">Todo el día</span>' : '') +
          (overdue ? '<span class="badge danger">Vencida</span>' : '') +
        '</div>' +
        '<div class="dc-sub">' + icon('calendar') + '<span>' + escapeHtml(when) + '</span></div>' +
        (d.Notes ? '<div class="dc-notes">' + escapeHtml(d.Notes) + '</div>' : '') +
      '</div>' +
      '<div class="dc-side">' +
        (count ? '<div class="dc-count">' + escapeHtml(count) + '</div>' : '') +
        '<div class="dc-actions">' +
          '<button type="button" class="icon-btn" data-toggle-deadline="' + escapeHtml(d.Id) + '" title="' + (d.Completed ? 'Marcar como pendiente' : 'Marcar como completada') + '">' + icon('check') + '</button>' +
          '<button type="button" class="icon-btn" data-pomodoro="' + escapeHtml(d.Id) + '" title="Estudiar con pomodoro">' + icon('play') + '</button>' +
          '<button type="button" class="icon-btn" data-edit-deadline="' + escapeHtml(d.Id) + '" title="Editar">' + icon('edit') + '</button>' +
          '<button type="button" class="icon-btn danger" data-delete-deadline="' + escapeHtml(d.Id) + '" title="Borrar">' + icon('trash') + '</button>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  function refreshDeadlineList() {
    var list = document.getElementById('deadlineList');
    if (list) list.innerHTML = deadlineListHtml();
    var sum = document.getElementById('deadlineSummary');
    if (sum) {
      var active = data.Deadlines.filter(function (d) { return !d.Completed; }).length;
      var done = data.Deadlines.length - active;
      sum.textContent = plural(active, 'entrega activa', 'entregas activas') + ' · ' + done + ' completadas';
    }
  }

  function openDeadlineDialog(id) {
    var editing = id ? data.Deadlines.filter(function (d) { return d.Id === id; })[0] : null;
    var due = editing ? parseDateOnly(editing.DueDate) : null;
    var dateValue = due ? isoDate(due) : isoDate(ui.tlView === 'day' ? ui.tlDate : new Date());
    var timeValue = editing ? (editing.DueTime || '23:59') : '23:59';
    var form = '<form data-form="deadline" data-id="' + escapeHtml(editing ? editing.Id : '') + '">' +
      '<div class="modal-body">' +
        '<div class="field"><label for="dlTitle">Título</label><input id="dlTitle" name="title" maxlength="140" placeholder="Ej. Ensayo de Cognición Matemática" value="' + escapeHtml(editing ? editing.Title : '') + '"></div>' +
        '<div class="field"><label for="dlSubject">Asignatura</label>' +
          '<input id="dlSubject" name="subject" list="subjectList" placeholder="Ej. Metodología" value="' + escapeHtml(editing ? editing.Subject : '') + '">' +
          '<datalist id="subjectList">' + registeredSubjects().map(function (s) { return '<option value="' + escapeHtml(s) + '"></option>'; }).join('') + '</datalist>' +
        '</div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="dlDate">Fecha límite</label><input id="dlDate" name="dueDate" type="date" value="' + dateValue + '"></div>' +
          '<div class="field"><label for="dlTime">Hora</label><input id="dlTime" name="dueTime" type="time" value="' + escapeHtml(timeValue) + '"' + (editing && editing.AllDay ? ' disabled' : '') + '></div>' +
        '</div>' +
        '<label class="check"><input type="checkbox" name="allDay"' + (editing && editing.AllDay ? ' checked' : '') + '><span class="box">' + icon('check') + '</span><span>Todo el día (sin hora fija)</span></label>' +
        '<div class="field"><label for="dlNotes">Notas (opcional)</label><textarea id="dlNotes" name="notes" placeholder="Qué hay que entregar, enlace, indicaciones…">' + escapeHtml(editing ? editing.Notes : '') + '</textarea></div>' +
        '<p class="form-error"></p>' +
      '</div>' +
      '<div class="modal-foot">' +
        (editing ? '<button type="button" class="btn btn-danger left" data-delete-deadline="' + escapeHtml(editing.Id) + '">' + icon('trash') + 'Borrar</button>' : '') +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Guardar cambios' : 'Crear entrega') + '</button>' +
      '</div>' +
    '</form>';
    openModal({
      title: editing ? 'Editar entrega' : 'Nueva entrega',
      subtitle: 'Se guarda en tu dispositivo y aparece en la línea de tiempo.',
      body: form
    });
  }

  function saveDeadlineForm(form) {
    var id = form.getAttribute('data-id');
    var title = form.querySelector('[name="title"]').value.trim();
    if (!title) { formError('Escribe un título para la entrega.'); return; }
    var dateValue = form.querySelector('[name="dueDate"]').value;
    if (!dateValue) { formError('Elige una fecha límite.'); return; }
    var allDay = form.querySelector('[name="allDay"]').checked;
    var timeValue = allDay ? '23:59' : (form.querySelector('[name="dueTime"]').value || '23:59');
    var editing = id ? data.Deadlines.filter(function (d) { return d.Id === id; })[0] : null;
    var target = editing || { Id: newId(), CreatedAt: stampLocal(new Date()), Completed: false, CompletedAt: '' };
    target.Title = title;
    target.Subject = form.querySelector('[name="subject"]').value.trim();
    target.DueDate = dateValue;
    target.DueTime = timeValue;
    target.AllDay = allDay;
    target.Notes = form.querySelector('[name="notes"]').value.trim();
    if (!editing) data.Deadlines.push(target);
    save();
    closeModal();
    render();
    toast(editing ? 'Entrega actualizada' : 'Entrega creada');
  }

  function toggleDeadline(id) {
    var d = data.Deadlines.filter(function (x) { return x.Id === id; })[0];
    if (!d) return;
    d.Completed = !d.Completed;
    d.CompletedAt = d.Completed ? stampLocal(new Date()) : '';
    save();
    render();
    toast(d.Completed ? 'Entrega completada' : 'Entrega marcada como pendiente');
  }

  function deleteDeadline(id) {
    var d = data.Deadlines.filter(function (x) { return x.Id === id; })[0];
    if (!d) return;
    askConfirm({
      title: 'Borrar entrega',
      message: 'Se eliminará <strong>“' + escapeHtml(d.Title) + '”</strong> de la lista y de la línea de tiempo. Esta acción no se puede deshacer.',
      confirmText: 'Borrar',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      data.Deadlines = data.Deadlines.filter(function (x) { return x.Id !== id; });
      save();
      closeModal();
      render();
      toast('Entrega borrada', 'warning');
    });
  }

  /* ------------------------------------------------------------
     Horarios
     ------------------------------------------------------------ */
  function renderSchedules() {
    var subjects = registeredSubjects();
    var blocks = data.Schedules.slice().sort(function (a, b) {
      var da = a.Days && a.Days.length ? Math.min.apply(null, a.Days) : 9;
      var db = b.Days && b.Days.length ? Math.min.apply(null, b.Days) : 9;
      if (da !== db) return da - db;
      return parseTime(a.StartTime, 480) - parseTime(b.StartTime, 480);
    });

    var html = '<div class="list-toolbar">' +
      '<span class="small muted">' + plural(blocks.length, 'bloque fijo', 'bloques fijos') + '</span>' +
      '<div class="spacer grow"></div>' +
      '<button type="button" class="btn btn-primary" data-new-schedule>' + icon('plus') + 'Nuevo horario</button>' +
    '</div>';

    if (subjects.length) {
      html += '<div class="subject-chips">' + subjects.map(function (s) {
        return '<span class="chip tone ' + toneClass(toneFor(s)) + '"><span class="dot"></span>' + escapeHtml(s) + '</span>';
      }).join('') + '</div>';
    }

    if (!blocks.length) {
      return html + '<div class="card"><div class="empty-state">' +
        '<div class="es-icon">' + icon('schedule') + '</div>' +
        '<strong>Tu semana está libre</strong>' +
        '<p>Agrega tus clases o bloques de estudio fijos. Se repetirán automáticamente cada semana y darán color a tus entregas.</p>' +
        '<div class="row"><button type="button" class="btn btn-primary" data-new-schedule>' + icon('plus') + 'Crear horario</button></div>' +
      '</div></div>';
    }

    html += '<div class="schedule-list">';
    blocks.forEach(function (s) {
      var tone = s.IsSubject ? (s.SubjectTone >= 0 ? s.SubjectTone : stableTone(s.Title)) : eventTone(s.Title, 4);
      html += '<div class="schedule-card ' + toneClass(tone) + '">' +
        '<div class="sc-top">' +
          '<div>' +
            '<div class="sc-title">' + escapeHtml(s.Title) + '</div>' +
            '<div class="sc-time">' + icon('clock') + ' ' + escapeHtml(s.StartTime) + ' – ' + escapeHtml(s.EndTime) + '</div>' +
          '</div>' +
          '<div class="sc-actions">' +
            '<button type="button" class="icon-btn" data-edit-schedule="' + escapeHtml(s.Id) + '" title="Editar">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn danger" data-delete-schedule="' + escapeHtml(s.Id) + '" title="Borrar">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="sc-days">';
      for (var day = 1; day <= 7; day++) {
        var d = day % 7;
        var on = s.Days && s.Days.indexOf(d) >= 0;
        html += '<span class="day-dot' + (on ? ' on' : '') + '">' + DAY_INITIAL[d] + '</span>';
      }
      html += '</div>' +
        (s.IsSubject ? '<div style="margin-top:8px;"><span class="badge">Asignatura</span></div>' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function openScheduleDialog(id) {
    var editing = id ? data.Schedules.filter(function (s) { return s.Id === id; })[0] : null;
    var selectedDays = editing && editing.Days ? editing.Days.slice() : [new Date().getDay()];
    var isSubject = editing ? !!editing.IsSubject : true;
    var tone = editing && editing.SubjectTone >= 0 ? editing.SubjectTone : nextTone();

    var dayButtons = '';
    for (var i = 0; i < 7; i++) {
      dayButtons += '<button type="button" class="day-dot' + (selectedDays.indexOf(i) >= 0 ? ' on' : '') + '" data-day-pick="' + i + '" title="' + DAY_NAMES[i] + '">' + DAY_INITIAL[i] + '</button>';
    }
    var swatches = '';
    for (var t = 0; t < TONE_COUNT; t++) {
      swatches += '<button type="button" class="swatch ' + toneClass(t) + (t === tone ? ' active' : '') + '" data-tone-pick="' + t + '" title="' + TONE_NAMES[t] + '"></button>';
    }

    var form = '<form data-form="schedule" data-id="' + escapeHtml(editing ? editing.Id : '') + '">' +
      '<div class="modal-body">' +
        '<div class="field"><label for="scTitle">Nombre del bloque</label><input id="scTitle" name="title" placeholder="Ej. Metodología" value="' + escapeHtml(editing ? editing.Title : '') + '"></div>' +
        '<div class="field"><span class="field-label">Días de la semana</span><div class="row wrap" data-days>' + dayButtons + '</div></div>' +
        '<div class="field-row">' +
          '<div class="field"><label for="scStart">Hora de inicio</label><input id="scStart" name="start" type="time" value="' + escapeHtml(editing ? editing.StartTime : '08:00') + '"></div>' +
          '<div class="field"><label for="scEnd">Hora de fin</label><input id="scEnd" name="end" type="time" value="' + escapeHtml(editing ? editing.EndTime : '10:00') + '"></div>' +
        '</div>' +
        '<label class="check"><input type="checkbox" name="isSubject"' + (isSubject ? ' checked' : '') + '><span class="box">' + icon('check') + '</span><span>Es una asignatura (comparte color con sus entregas)</span></label>' +
        '<div class="field" data-tone-wrap' + (isSubject ? '' : ' style="display:none"') + '><span class="field-label">Color de la asignatura</span><div class="swatches">' + swatches + '</div></div>' +
        '<p class="form-hint">El bloque se repetirá cada semana en la línea de tiempo.</p>' +
        '<p class="form-error"></p>' +
      '</div>' +
      '<div class="modal-foot">' +
        (editing ? '<button type="button" class="btn btn-danger left" data-delete-schedule="' + escapeHtml(editing.Id) + '">' + icon('trash') + 'Borrar</button>' : '') +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Guardar cambios' : 'Crear horario') + '</button>' +
      '</div>' +
    '</form>';
    openModal({
      title: editing ? 'Editar horario' : 'Nuevo horario',
      subtitle: 'Este bloque se repetirá automáticamente cada semana.',
      body: form
    });
    var formEl = document.querySelector('[data-form="schedule"]');
    var subjectCheck = formEl.querySelector('[name="isSubject"]');
    subjectCheck.addEventListener('change', function () {
      formEl.querySelector('[data-tone-wrap]').style.display = subjectCheck.checked ? '' : 'none';
    });
  }

  function saveScheduleForm(form) {
    var id = form.getAttribute('data-id');
    var title = form.querySelector('[name="title"]').value.trim();
    if (!title) { formError('Escribe un nombre para el bloque.'); return; }
    var days = [];
    form.querySelectorAll('[data-day-pick].on').forEach(function (b) { days.push(number(b.getAttribute('data-day-pick'), 0)); });
    if (!days.length) { formError('Selecciona al menos un día de la semana.'); return; }
    var start = form.querySelector('[name="start"]').value || '08:00';
    var end = form.querySelector('[name="end"]').value || '10:00';
    if (parseTime(end, 600) <= parseTime(start, 480)) { formError('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    var isSubject = form.querySelector('[name="isSubject"]').checked;
    var activeTone = form.querySelector('[data-tone-pick].active');
    var tone = activeTone ? number(activeTone.getAttribute('data-tone-pick'), nextTone()) : nextTone();
    if (isSubject) {
      data.Schedules.forEach(function (other) {
        if (other.Id === id || !other.IsSubject) return;
        if (String(other.Title || '').trim().toLocaleLowerCase() !== title.toLocaleLowerCase()) return;
        if (other.SubjectTone >= 0 && other.SubjectTone < TONE_COUNT) tone = other.SubjectTone;
      });
    }
    var editing = id ? data.Schedules.filter(function (s) { return s.Id === id; })[0] : null;
    var target = editing || { Id: newId() };
    target.Title = title;
    target.Days = days.sort();
    target.StartTime = start;
    target.EndTime = end;
    target.IsSubject = isSubject;
    target.SubjectTone = isSubject ? tone : -1;
    if (!editing) data.Schedules.push(target);
    save();
    closeModal();
    render();
    toast(editing ? 'Horario actualizado' : 'Horario creado');
  }

  function deleteSchedule(id) {
    var s = data.Schedules.filter(function (x) { return x.Id === id; })[0];
    if (!s) return;
    askConfirm({
      title: 'Borrar horario',
      message: 'Se eliminará <strong>“' + escapeHtml(s.Title) + '”</strong> de todos los días en que se repite. Las entregas no se borran.',
      confirmText: 'Borrar',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      data.Schedules = data.Schedules.filter(function (x) { return x.Id !== id; });
      save();
      closeModal();
      render();
      toast('Horario borrado', 'warning');
    });
  }

  /* ------------------------------------------------------------
     Actividades
     ------------------------------------------------------------ */
  function openActivityDialog(id) {
    var editing = id ? data.Activities.filter(function (a) { return a.Id === id; })[0] : null;
    var dateValue = editing ? (editing.Date || isoDate(new Date())) : isoDate(ui.tlView === 'day' ? ui.tlDate : new Date());
    var form = '<form data-form="activity" data-id="' + escapeHtml(editing ? editing.Id : '') + '">' +
      '<div class="modal-body">' +
        '<div class="field"><label for="acTitle">¿Qué vas a hacer?</label><input id="acTitle" name="title" placeholder="Ej. Estudiar para el examen de Historia" value="' + escapeHtml(editing ? editing.Title : '') + '"></div>' +
        '<div class="field"><label for="acSubject">Asignatura (opcional)</label>' +
          '<input id="acSubject" name="subject" list="subjectList2" placeholder="Sin asignatura" value="' + escapeHtml(editing ? editing.Subject : '') + '">' +
          '<datalist id="subjectList2">' + registeredSubjects().map(function (s) { return '<option value="' + escapeHtml(s) + '"></option>'; }).join('') + '</datalist>' +
        '</div>' +
        '<div class="field-row three">' +
          '<div class="field"><label for="acDate">Fecha</label><input id="acDate" name="date" type="date" value="' + escapeHtml(dateValue) + '"></div>' +
          '<div class="field"><label for="acStart">Hora de inicio</label><input id="acStart" name="start" type="time" value="' + escapeHtml(editing ? editing.StartTime : '16:00') + '"></div>' +
          '<div class="field"><label for="acEnd">Hora de fin</label><input id="acEnd" name="end" type="time" value="' + escapeHtml(editing ? editing.EndTime : '17:00') + '"></div>' +
        '</div>' +
        '<div class="field"><label for="acNotes">Notas (opcional)</label><textarea id="acNotes" name="notes" placeholder="Qué llevar, con quién, dónde…">' + escapeHtml(editing ? editing.Notes : '') + '</textarea></div>' +
        '<p class="form-hint">Se mostrará en la fila «Actividades» de la línea de tiempo, solo ese día.</p>' +
        '<p class="form-error"></p>' +
      '</div>' +
      '<div class="modal-foot">' +
        (editing ? '<button type="button" class="btn btn-danger left" data-delete-activity="' + escapeHtml(editing.Id) + '">' + icon('trash') + 'Borrar</button>' : '') +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Guardar cambios' : 'Crear actividad') + '</button>' +
      '</div>' +
    '</form>';
    openModal({
      title: editing ? 'Editar actividad' : 'Nueva actividad',
      subtitle: 'Para tu día a día: no se repite cada semana, solo cuenta ese día.',
      body: form
    });
  }

  function saveActivityForm(form) {
    var id = form.getAttribute('data-id');
    var title = form.querySelector('[name="title"]').value.trim();
    if (!title) { formError('Escribe un título para la actividad.'); return; }
    var date = form.querySelector('[name="date"]').value;
    if (!date) { formError('Elige una fecha.'); return; }
    var start = form.querySelector('[name="start"]').value || '16:00';
    var end = form.querySelector('[name="end"]').value || '17:00';
    if (parseTime(end, 1020) <= parseTime(start, 960)) { formError('La hora de fin debe ser posterior a la hora de inicio.'); return; }
    var editing = id ? data.Activities.filter(function (a) { return a.Id === id; })[0] : null;
    var target = editing || { Id: newId(), CreatedAt: stampLocal(new Date()) };
    target.Title = title;
    target.Subject = form.querySelector('[name="subject"]').value.trim();
    target.Date = date;
    target.StartTime = start;
    target.EndTime = end;
    target.Notes = form.querySelector('[name="notes"]').value.trim();
    if (!editing) data.Activities.push(target);
    save();
    closeModal();
    render();
    toast(editing ? 'Actividad actualizada' : 'Actividad creada');
  }

  function deleteActivity(id) {
    var a = data.Activities.filter(function (x) { return x.Id === id; })[0];
    if (!a) return;
    askConfirm({
      title: 'Borrar actividad',
      message: 'Se eliminará <strong>“' + escapeHtml(a.Title) + '”</strong> de la línea de tiempo.',
      confirmText: 'Borrar',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      data.Activities = data.Activities.filter(function (x) { return x.Id !== id; });
      save();
      closeModal();
      render();
      toast('Actividad borrada', 'warning');
    });
  }

  /* ------------------------------------------------------------
     Pendientes generales (post-its)
     ------------------------------------------------------------ */
  function postItRotation(note) {
    var hash = 0;
    for (var i = 0; i < note.Id.length; i++) hash = (hash * 31 + note.Id.charCodeAt(i)) & 0xffff;
    return ((hash % 31) / 10 - 1.5).toFixed(2);
  }

  function renderPostIts() {
    var notes = data.PostIts;
    var html = '<div class="list-toolbar">' +
      '<span class="small muted">' + plural(notes.length, 'nota en el tablón', 'notas en el tablón') + '</span>' +
      '<div class="spacer grow"></div>' +
      '<button type="button" class="btn btn-primary" data-new-postit>' + icon('plus') + 'Nuevo pendiente</button>' +
    '</div>' +
    '<div class="postit-board" id="postitBoard">';
    if (!notes.length) {
      html += '<div class="board-empty">' +
        '<div class="big">' + icon('note') + '</div>' +
        '<strong>Tu tablón está vacío</strong>' +
        '<p class="small">Crea notas para ideas, trámites o tareas sin fecha. Puedes arrastrarlas y marcar sus pendientes.</p>' +
        '<button type="button" class="btn btn-primary" data-new-postit>' + icon('plus') + 'Crear primera nota</button>' +
      '</div>';
    }
    notes.forEach(function (note) {
      var tone = note.Tone % TONE_COUNT;
      var total = note.Items.length;
      var done = note.Items.filter(function (it) { return it.Done; }).length;
      var pct = total ? Math.round(done / total * 100) : 0;
      html += '<div class="postit ' + toneClass(tone) + '" data-note="' + escapeHtml(note.Id) + '" style="left:' + note.X + 'px;top:' + note.Y + 'px;--rot:' + postItRotation(note) + 'deg;">' +
        '<div class="postit-head">' +
          '<span class="postit-grip">' + icon('grip') + '</span>' +
          '<h3 class="postit-title">' + escapeHtml(note.Title || 'Sin título') + '</h3>' +
          '<div class="postit-menu">' +
            '<button type="button" class="icon-btn" data-edit-postit="' + escapeHtml(note.Id) + '" title="Editar nota">' + icon('edit') + '</button>' +
            '<button type="button" class="icon-btn danger" data-delete-postit="' + escapeHtml(note.Id) + '" title="Borrar nota">' + icon('trash') + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="postit-items">';
      note.Items.forEach(function (it, index) {
        html += '<div class="postit-item' + (it.Done ? ' done' : '') + '">' +
          '<label class="check"><input type="checkbox" data-postit-item="' + escapeHtml(note.Id) + '" data-item-index="' + index + '"' + (it.Done ? ' checked' : '') + '><span class="box">' + icon('check') + '</span><span>' + escapeHtml(it.Text) + '</span></label>' +
          '<button type="button" class="item-del" data-postit-item-del="' + escapeHtml(note.Id) + '" data-item-index="' + index + '" title="Quitar pendiente">' + icon('x') + '</button>' +
        '</div>';
      });
      html += '</div>' +
        '<form class="postit-add" data-postit-add="' + escapeHtml(note.Id) + '">' +
          '<input type="text" placeholder="Agregar pendiente…" maxlength="160" aria-label="Nuevo pendiente">' +
          '<button type="submit" title="Agregar">' + icon('plus') + '</button>' +
        '</form>' +
        (total ? '<div class="postit-progress"><span>' + done + '/' + total + '</span><span class="bar"><i style="width:' + pct + '%"></i></span><span>' + pct + '%</span></div>' : '') +
      '</div>';
    });
    html += '</div>';
    return html;
  }

  function clampPostIts() {
    var board = document.getElementById('postitBoard');
    if (!board) return;
    var rect = board.getBoundingClientRect();
    data.PostIts.forEach(function (note) {
      var el = board.querySelector('[data-note="' + note.Id + '"]');
      if (!el) return;
      var w = el.offsetWidth || 220;
      var h = el.offsetHeight || 120;
      note.X = clamp(note.X, 4, Math.max(4, rect.width - w - 4));
      note.Y = clamp(note.Y, 4, Math.max(4, rect.height - h - 4));
      el.style.left = note.X + 'px';
      el.style.top = note.Y + 'px';
    });
  }

  function bindPostItDrag() {
    var board = document.getElementById('postitBoard');
    if (!board) return;
    window.requestAnimationFrame(clampPostIts);
    board.querySelectorAll('.postit').forEach(function (el) {
      var head = el.querySelector('.postit-head');
      if (!head) return;
      head.addEventListener('pointerdown', function (e) {
        if (e.target.closest('button')) return;
        var note = data.PostIts.filter(function (n) { return n.Id === el.getAttribute('data-note'); })[0];
        if (!note) return;
        var rect = el.getBoundingClientRect();
        ui.dragging = { note: note, el: el, dx: e.clientX - rect.left, dy: e.clientY - rect.top, board: board };
        el.classList.add('dragging');
        head.setPointerCapture && head.setPointerCapture(e.pointerId);
        e.preventDefault();
      });
    });
    if (!ui.postItMoveBound) {
      ui.postItMoveBound = true;
      document.addEventListener('pointermove', function (e) {
        if (!ui.dragging) return;
        var drag = ui.dragging;
        var rect = drag.board.getBoundingClientRect();
        var w = drag.el.offsetWidth || 220;
        var h = drag.el.offsetHeight || 120;
        var x = clamp(e.clientX - rect.left - drag.dx, 4, Math.max(4, rect.width - w - 4));
        var y = clamp(e.clientY - rect.top - drag.dy, 4, Math.max(4, rect.height - h - 4));
        drag.note.X = Math.round(x);
        drag.note.Y = Math.round(y);
        drag.el.style.left = drag.note.X + 'px';
        drag.el.style.top = drag.note.Y + 'px';
      });
      document.addEventListener('pointerup', function () {
        if (!ui.dragging) return;
        var drag = ui.dragging;
        drag.el.classList.remove('dragging');
        ui.dragging = null;
        save();
      });
      window.addEventListener('resize', function () { if (ui.page === 'postits') clampPostIts(); });
    }
  }

  function openPostItDialog(id) {
    var editing = id ? data.PostIts.filter(function (p) { return p.Id === id; })[0] : null;
    var tone = editing ? editing.Tone : (data.PostIts.length % TONE_COUNT);
    var swatches = '';
    for (var t = 0; t < TONE_COUNT; t++) {
      swatches += '<button type="button" class="swatch ' + toneClass(t) + (t === tone ? ' active' : '') + '" data-tone-pick="' + t + '" title="' + TONE_NAMES[t] + '"></button>';
    }
    var lines = editing ? editing.Items.map(function (it) { return it.Text; }).join('\n') : '';
    var form = '<form data-form="postit" data-id="' + escapeHtml(editing ? editing.Id : '') + '">' +
      '<div class="modal-body">' +
        '<div class="field"><label for="piTitle">Título</label><input id="piTitle" name="title" placeholder="Ej. Trámites de la escuela" value="' + escapeHtml(editing ? editing.Title : '') + '"></div>' +
        '<div class="field"><span class="field-label">Color de la nota</span><div class="swatches">' + swatches + '</div></div>' +
        '<div class="field"><label for="piItems">Lista de pendientes (una tarea por línea)</label><textarea id="piItems" name="items" placeholder="Comprar material&#10;Pedir constancia&#10;Revisar correo">' + escapeHtml(lines) + '</textarea></div>' +
        '<p class="form-error"></p>' +
      '</div>' +
      '<div class="modal-foot">' +
        (editing ? '<button type="button" class="btn btn-danger left" data-delete-postit="' + escapeHtml(editing.Id) + '">' + icon('trash') + 'Borrar</button>' : '') +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
        '<button type="submit" class="btn btn-primary">' + (editing ? 'Guardar cambios' : 'Crear nota') + '</button>' +
      '</div>' +
    '</form>';
    openModal({
      title: editing ? 'Editar pendiente' : 'Nuevo pendiente',
      subtitle: 'Una nota para ideas, trámites o tareas sin fecha límite.',
      body: form
    });
  }

  function savePostItForm(form) {
    var id = form.getAttribute('data-id');
    var title = form.querySelector('[name="title"]').value.trim();
    if (!title) { formError('Escribe un título para la nota.'); return; }
    var editing = id ? data.PostIts.filter(function (p) { return p.Id === id; })[0] : null;
    var toneEl = form.querySelector('[data-tone-pick].active');
    var tone = toneEl ? number(toneEl.getAttribute('data-tone-pick'), 0) : 0;
    var lines = form.querySelector('[name="items"]').value.replace(/\r/g, '').split('\n');
    var items = [];
    lines.forEach(function (line) {
      var text = line.trim();
      if (!text) return;
      var item = { Text: text, Done: false };
      if (editing && editing.Items && items.length < editing.Items.length) {
        var old = editing.Items[items.length];
        if (old.Text === text) item.Done = old.Done;
      }
      items.push(item);
    });
    var target = editing || { Id: newId(), X: 26 + (data.PostIts.length % 6) * 24, Y: 26 + (data.PostIts.length % 6) * 22 };
    target.Title = title;
    target.Tone = tone;
    target.Items = items;
    if (!editing) data.PostIts.push(target);
    save();
    closeModal();
    render();
    toast(editing ? 'Nota actualizada' : 'Nota creada');
  }

  function togglePostItItem(noteId, index, done) {
    var note = data.PostIts.filter(function (n) { return n.Id === noteId; })[0];
    if (!note || !note.Items[index]) return;
    note.Items[index].Done = done;
    save();
    render();
  }

  function addPostItItem(noteId, text) {
    var note = data.PostIts.filter(function (n) { return n.Id === noteId; })[0];
    if (!note) return;
    text = String(text || '').trim();
    if (!text) return;
    note.Items.push({ Text: text, Done: false });
    save();
    render();
    var board = document.getElementById('postitBoard');
    var input = board && board.querySelector('[data-postit-add="' + noteId + '"] input');
    if (input) input.focus();
  }

  function deletePostItItem(noteId, index) {
    var note = data.PostIts.filter(function (n) { return n.Id === noteId; })[0];
    if (!note) return;
    note.Items.splice(index, 1);
    save();
    render();
  }

  function deletePostIt(id) {
    var note = data.PostIts.filter(function (n) { return n.Id === id; })[0];
    if (!note) return;
    askConfirm({
      title: 'Borrar pendiente',
      message: 'Se eliminará la nota <strong>“' + escapeHtml(note.Title) + '”</strong> del tablón.',
      confirmText: 'Borrar',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      data.PostIts = data.PostIts.filter(function (n) { return n.Id !== id; });
      save();
      closeModal();
      render();
      toast('Nota borrada', 'warning');
    });
  }

  /* ------------------------------------------------------------
     Pomodoro
     ------------------------------------------------------------ */
  function phaseDuration(phase) {
    var st = data.Settings;
    if (phase === 'descanso') return st.ShortBreakMinutes * 60;
    if (phase === 'descanso_largo') return st.LongBreakMinutes * 60;
    return st.WorkMinutes * 60;
  }

  function timerRemaining() {
    var t = data.Timer;
    if (t.Running) {
      var ends = parseStamp(t.EndsAtUtc);
      if (ends) return Math.max(0, Math.ceil((ends.getTime() - Date.now()) / 1000));
      return Math.max(0, t.RemainingSeconds);
    }
    return Math.max(0, t.RemainingSeconds);
  }

  function timerProgress() {
    var t = data.Timer;
    if (!t.DurationSeconds) return 0;
    return clamp(1 - timerRemaining() / t.DurationSeconds, 0, 1);
  }

  function timerPhaseLabel() {
    return PHASE_LABEL[data.Timer.Phase] || 'Enfoque';
  }

  function renderTimerCard() {
    var card = document.getElementById('timerCard');
    var mini = document.getElementById('miniTimer');
    var miniText = document.getElementById('miniTimerText');
    var t = data.Timer;
    var hasTask = !!t.TaskId;
    var remaining = timerRemaining();
    var progress = Math.round(timerProgress() * 100);
    var phase = timerPhaseLabel();
    var cls = 'timer-card' + (!hasTask ? ' idle' : (t.Phase === 'trabajo' ? '' : ' break'));

    if (card) {
      card.className = cls;
      card.innerHTML = '<div class="timer-head">' +
          '<span class="timer-phase">' + (hasTask ? phase : 'Sin tarea') + '</span>' +
          (hasTask ? '<span class="badge ' + (t.Phase === 'trabajo' ? '' : 'success') + '">' + t.CompletedWorkPeriods + '/' + data.Settings.LongBreakEvery + '</span>' : '') +
        '</div>' +
        '<div class="timer-task' + (hasTask ? '' : ' muted') + '" ' + (hasTask ? 'data-pomo-open title="Abrir pomodoro"' : '') + '>' +
          escapeHtml(hasTask ? t.TaskTitle : 'Elige una entrega para empezar a enfocarte') +
        '</div>' +
        '<div class="timer-ring" style="--p:' + progress + '">' +
          '<span class="timer-time">' + fmtClock(remaining) + '</span>' +
        '</div>' +
        '<div class="timer-meta">' + (hasTask ? escapeHtml(t.Subject || 'Sin asignatura') : '25 minutos por bloque') + '</div>' +
        '<div class="timer-actions">' +
          (hasTask
            ? '<button type="button" class="btn btn-primary" data-pomo-toggle>' + icon(t.Running ? 'pause' : 'play') + (t.Running ? 'Pausar' : 'Seguir') + '</button>' +
              '<button type="button" class="icon-btn" data-pomo-stop title="Terminar pomodoro">' + icon('stop') + '</button>'
            : '<button type="button" class="btn btn-primary btn-block" data-pomo-pick>' + icon('deadline') + 'Elegir entrega</button>') +
        '</div>';
    }

    if (mini) {
      mini.classList.remove('hidden');
      mini.classList.toggle('running', !!t.Running);
      mini.innerHTML = icon('clock') + '<span id="miniTimerText">' + fmtClock(remaining) + '</span>';
      mini.title = hasTask ? (phase + ' · ' + t.TaskTitle) : 'Abrir pomodoro';
    }
    refreshPomodoroPanel();
  }

  function pomodoroPanelHtml() {
    var t = data.Timer;
    var hasTask = !!t.TaskId;
    var remaining = timerRemaining();
    if (!hasTask) {
      return '<div id="pomoPanel">' +
        '<div class="modal-body">' +
          '<div class="modal-icon">' + icon('clock') + '</div>' +
          '<p class="pomo-sub">Elige una entrega para empezar un pomodoro de ' + data.Settings.WorkMinutes + ' minutos. Al terminar se registrará el tiempo de enfoque.</p>' +
        '</div>' +
        '<div class="modal-foot">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>' +
          '<button type="button" class="btn btn-primary" data-pomo-pick>' + icon('deadline') + 'Elegir entrega</button>' +
        '</div>' +
      '</div>';
    }
    return '<div id="pomoPanel">' +
      '<div class="modal-body">' +
        '<div class="row" style="justify-content:center;"><span class="timer-phase">' + escapeHtml(timerPhaseLabel()) + '</span>' +
          '<span class="chip ' + toneClass(eventTone(t.Subject, 6)) + '">' + escapeHtml(t.Subject || 'Sin asignatura') + '</span></div>' +
        '<div class="pomo-big">' + fmtClock(remaining) + '</div>' +
        '<p class="pomo-sub"><strong>' + escapeHtml(t.TaskTitle) + '</strong><br>' +
          (t.Phase === 'trabajo' ? 'Bloque ' + (t.CompletedWorkPeriods + 1) + ' de ' + data.Settings.LongBreakEvery : 'Descanso') +
        '</p>' +
        '<div class="timer-ring" style="--p:' + Math.round(timerProgress() * 100) + ';margin:4px auto 0;"><span class="timer-time">' + fmtClock(remaining) + '</span></div>' +
      '</div>' +
      '<div class="modal-foot">' +
        '<button type="button" class="btn btn-danger left" data-pomo-stop>' + icon('stop') + 'Terminar</button>' +
        '<button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button>' +
        '<button type="button" class="btn btn-primary" data-pomo-toggle>' + icon(t.Running ? 'pause' : 'play') + (t.Running ? 'Pausar' : 'Seguir') + '</button>' +
      '</div>' +
    '</div>';
  }

  function openPomodoroPanel() {
    openModal({
      title: 'Pomodoro',
      subtitle: 'Enfoque por bloques, con descansos automáticos.',
      narrow: true,
      body: pomodoroPanelHtml()
    });
  }

  function refreshPomodoroPanel() {
    var panel = document.getElementById('pomoPanel');
    if (panel) panel.outerHTML = pomodoroPanelHtml();
  }

  function startTimer() {
    var t = data.Timer;
    if (!t.TaskId) return false;
    if (t.Running) return true;
    if (!t.Active) {
      var duration = phaseDuration(t.Phase);
      t.DurationSeconds = duration;
      t.RemainingSeconds = duration;
      t.Active = true;
      t.StartedAt = stampLocal(new Date());
    }
    if (t.RemainingSeconds <= 0) {
      t.RemainingSeconds = Math.max(1, phaseDuration(t.Phase));
      t.DurationSeconds = t.RemainingSeconds;
    }
    t.Running = true;
    t.EndsAtUtc = stampUtc(new Date(Date.now() + t.RemainingSeconds * 1000));
    save();
    render();
    return true;
  }

  function pauseTimer() {
    var t = data.Timer;
    if (!t.Running) return;
    t.RemainingSeconds = Math.max(0, Math.ceil(timerRemaining()));
    t.Running = false;
    t.EndsAtUtc = '';
    save();
    render();
  }

  function toggleTimer() {
    if (!data.Timer.TaskId) { openPomodoroPanel(); return; }
    if (data.Timer.Running) pauseTimer(); else startTimer();
  }

  function clearTimerState() {
    data.Timer = defaultTimer();
    data.Timer.DurationSeconds = phaseDuration('trabajo');
    data.Timer.RemainingSeconds = data.Timer.DurationSeconds;
  }

  function stopTimer(recordPartial) {
    var t = data.Timer;
    if (!t.TaskId) return;
    if (t.Active && recordPartial) {
      var remaining = Math.max(0, Math.ceil(timerRemaining()));
      var elapsed = Math.max(0, t.DurationSeconds - remaining);
      if (elapsed >= 5) recordSession(t.Phase, elapsed, new Date());
    }
    clearTimerState();
    save();
    render();
    toast('Pomodoro terminado', 'warning');
  }

  function recordSession(phase, seconds, completedAt) {
    if (seconds < 1) return;
    var t = data.Timer;
    data.Sessions.push({
      Id: newId(),
      Start: stampLocal(new Date(completedAt.getTime() - seconds * 1000)),
      End: stampLocal(completedAt),
      DurationSeconds: Math.round(seconds),
      Type: phase === 'trabajo' ? 'trabajo' : 'descanso',
      TaskId: t.TaskId,
      TaskTitle: t.TaskTitle,
      Subject: t.Subject,
      Note: phase === 'descanso_largo' ? 'Descanso largo' : (phase === 'descanso' ? 'Descanso corto' : 'Pomodoro')
    });
  }

  function completePhase(allowAutoStart, completedAt) {
    var t = data.Timer;
    if (!t.TaskId) return;
    var completedPhase = t.Phase;
    var duration = t.DurationSeconds > 0 ? t.DurationSeconds : phaseDuration(completedPhase);
    recordSession(completedPhase, duration, completedAt);
    var wasWork = completedPhase === 'trabajo';
    if (wasWork) t.CompletedWorkPeriods++;
    var nextPhase;
    if (wasWork) {
      var every = Math.max(1, data.Settings.LongBreakEvery);
      nextPhase = (t.CompletedWorkPeriods % every === 0) ? 'descanso_largo' : 'descanso';
    } else {
      nextPhase = 'trabajo';
    }
    t.Phase = nextPhase;
    t.DurationSeconds = phaseDuration(nextPhase);
    t.RemainingSeconds = t.DurationSeconds;
    t.Running = false;
    t.Active = false;
    t.StartedAt = '';
    t.EndsAtUtc = '';

    var nextStarted = false;
    if (allowAutoStart) {
      if (nextPhase === 'trabajo' && data.Settings.AutoStartWork) nextStarted = startTimer();
      else if (nextPhase !== 'trabajo' && data.Settings.AutoStartBreak) nextStarted = startTimer();
    }

    save();
    render();

    var title, message;
    if (wasWork) {
      title = 'Pomodoro completado';
      message = nextPhase === 'descanso_largo'
        ? 'Buen trabajo. Te toca un descanso largo de ' + data.Settings.LongBreakMinutes + ' min.'
        : 'Buen trabajo. Te toca un descanso de ' + data.Settings.ShortBreakMinutes + ' min.';
      if (nextStarted) message += ' El descanso ya está corriendo.';
    } else {
      title = 'Descanso terminado';
      message = 'Es momento de volver al enfoque. Inicia tu próximo pomodoro cuando estés listo.';
      if (nextStarted) message += ' El siguiente pomodoro ya está corriendo.';
    }
    toast(message, wasWork ? 'success' : 'warning');
    notify(title, message);
    if (data.Settings.Sound) beep();
  }

  function tickTimerUi() {
    if (!data) return;
    renderTimerCard();
    if (data.Timer.Active && data.Timer.Running) {
      var ends = parseStamp(data.Timer.EndsAtUtc);
      if (ends && Date.now() >= ends.getTime()) completePhase(true, new Date());
    }
  }

  function recoverTimer() {
    var t = data.Timer;
    if (t.Running) {
      var ends = parseStamp(t.EndsAtUtc);
      if (ends && ends.getTime() <= Date.now()) completePhase(false, ends);
    } else if (t.Active && t.RemainingSeconds <= 0) {
      t.RemainingSeconds = phaseDuration(t.Phase);
      t.DurationSeconds = t.RemainingSeconds;
      t.Active = false;
      save();
    }
  }

  function beginForDeadline(deadline) {
    var t = data.Timer;
    t.TaskId = deadline.Id;
    t.TaskTitle = deadline.Title;
    t.Subject = deadline.Subject;
    t.Phase = 'trabajo';
    t.DurationSeconds = phaseDuration('trabajo');
    t.RemainingSeconds = t.DurationSeconds;
    t.Running = false;
    t.Active = false;
    t.StartedAt = '';
    t.EndsAtUtc = '';
    t.CompletedWorkPeriods = 0;
    startTimer();
  }

  function startPomodoroForDeadline(id) {
    var deadline = data.Deadlines.filter(function (d) { return d.Id === id; })[0];
    if (!deadline) return;
    var t = data.Timer;
    if (t.TaskId && t.TaskId !== id && (t.Active || t.Running)) {
      askConfirm({
        title: 'Ya hay un pomodoro activo',
        message: 'Ahora mismo estás enfocado en <strong>“' + escapeHtml(t.TaskTitle) + '”</strong>. Si empiezas otro, se guardará el tiempo parcial del actual.',
        confirmText: 'Cambiar de tarea',
        danger: false
      }).then(function (ok) {
        if (!ok) return;
        stopTimer(true);
        beginForDeadline(deadline);
        toast('Pomodoro iniciado: ' + deadline.Title);
      });
      return;
    }
    if (t.TaskId === id) {
      if (!t.Running) startTimer();
      else toast('Ese pomodoro ya está corriendo');
      return;
    }
    beginForDeadline(deadline);
    toast('Pomodoro iniciado: ' + deadline.Title);
    if (window.matchMedia && window.matchMedia('(max-width: 900px)').matches) openPomodoroPanel();
  }

  function notify(title, message) {
    if (!data.Settings.Notifications) return;
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    try {
      new Notification(title, { body: message, icon: 'icons/icon-192.png', tag: 'enfoque-pomodoro' });
    } catch (e) { /* algunos navegadores no permiten notificaciones locales */ }
  }

  var audioCtx = null;
  function beep() {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      var now = audioCtx.currentTime;
      [660, 880].forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.0001, now + i * 0.18);
        gain.gain.exponentialRampToValueAtTime(0.16, now + i * 0.18 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.18 + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(now + i * 0.18);
        osc.stop(now + i * 0.18 + 0.2);
      });
    } catch (e) { /* silencio */ }
  }

  /* ------------------------------------------------------------
     Resumen
     ------------------------------------------------------------ */
  function summaryBounds() {
    var now = new Date();
    if (ui.summaryRange === 0) return { from: startOfDay(now), to: startOfDay(now), label: 'Hoy · ' + dateLong(now) };
    if (ui.summaryRange === 1) {
      var mon = startOfWeek(now);
      return { from: mon, to: startOfDay(now), label: 'Semana del ' + dateMedium(mon) + ' al ' + dateMedium(addDays(mon, 6)) };
    }
    if (ui.summaryRange === 2) {
      return { from: startOfMonth(now), to: startOfDay(now), label: monthTitle(now) };
    }
    return { from: null, to: startOfDay(now), label: 'Todo el historial' };
  }

  function buildSummary(from, to) {
    var result = { sessions: [], work: 0, breaks: 0, count: 0, byTask: {}, bySubject: {}, byDay: {}, byWeek: {} };
    (data.Sessions || []).forEach(function (s) {
      var start = parseStamp(s.Start) || new Date();
      var day = startOfDay(start);
      if (from && day < from) return;
      if (to && day > to) return;
      var duration = Math.max(0, number(s.DurationSeconds, 0));
      var isBreak = String(s.Type).toLocaleLowerCase() === 'descanso';
      result.count++;
      if (isBreak) result.breaks += duration; else result.work += duration;
      result.sessions.push(s);
      var dayKey = isoDate(day);
      if (!result.byDay[dayKey]) result.byDay[dayKey] = { key: dayKey, work: 0, breaks: 0 };
      if (isBreak) result.byDay[dayKey].breaks += duration; else result.byDay[dayKey].work += duration;
      var mon = startOfWeek(day);
      var weekKey = isoDate(mon);
      if (!result.byWeek[weekKey]) result.byWeek[weekKey] = { key: weekKey, work: 0, breaks: 0 };
      if (isBreak) result.byWeek[weekKey].breaks += duration; else result.byWeek[weekKey].work += duration;
      if (!isBreak) {
        var taskKey = String(s.TaskTitle || '').trim() || 'Sin tarea';
        var subjectKey = String(s.Subject || '').trim() || 'Sin materia';
        if (!result.byTask[taskKey]) result.byTask[taskKey] = { key: taskKey, label: taskKey, detail: subjectKey, work: 0 };
        result.byTask[taskKey].work += duration;
        if (!result.bySubject[subjectKey]) result.bySubject[subjectKey] = { key: subjectKey, label: subjectKey, detail: 'Trabajo enfocado', work: 0 };
        result.bySubject[subjectKey].work += duration;
      }
    });
    result.sessions.sort(function (a, b) {
      var sa = parseStamp(a.Start), sb = parseStamp(b.Start);
      return (sb ? sb.getTime() : 0) - (sa ? sa.getTime() : 0);
    });
    result.byTaskList = Object.keys(result.byTask).map(function (k) { return result.byTask[k]; }).sort(function (a, b) { return b.work - a.work; });
    result.bySubjectList = Object.keys(result.bySubject).map(function (k) { return result.bySubject[k]; }).sort(function (a, b) { return b.work - a.work; });
    return result;
  }

  function summaryChart(summary) {
    var now = new Date();
    var items = [];
    var i, day, src;
    if (ui.summaryRange === 0 || ui.summaryRange === 1) {
      var start = ui.summaryRange === 0 ? addDays(startOfDay(now), -6) : startOfWeek(now);
      for (i = 0; i < 7; i++) {
        day = addDays(start, i);
        src = summary.byDay[isoDate(day)];
        items.push({ label: DAY_SHORT[day.getDay()], value: src ? src.work : 0, today: sameDay(day, now) });
      }
    } else if (ui.summaryRange === 2) {
      var first = startOfMonth(now);
      var week = startOfWeek(first);
      i = 1;
      while (week <= startOfDay(now) && i <= 6) {
        src = summary.byWeek[isoDate(week)];
        items.push({ label: 'Sem ' + i, value: src ? src.work : 0, today: false });
        week = addDays(week, 7);
        i++;
      }
    } else {
      var keys = Object.keys(summary.byWeek).sort();
      keys.slice(-12).forEach(function (key) {
        src = summary.byWeek[key];
        items.push({ label: dateMedium(parseDateOnly(key)), value: src ? src.work : 0, today: false });
      });
    }
    return items;
  }

  function renderSummary() {
    var bounds = summaryBounds();
    var summary = buildSummary(bounds.from, bounds.to);
    var workSessions = summary.sessions.filter(function (s) { return String(s.Type).toLocaleLowerCase() !== 'descanso'; }).length;
    var breakSessions = summary.sessions.length - workSessions;
    var activeDays = Object.keys(summary.byDay).length;
    var html = '<div class="list-toolbar">' +
      '<div class="segmented">' +
        ['Hoy', 'Semana', 'Mes', 'Todo'].map(function (label, index) {
          return '<button type="button" data-range="' + index + '" class="' + (ui.summaryRange === index ? 'active' : '') + '">' + label + '</button>';
        }).join('') +
      '</div>' +
      '<span class="small muted">' + escapeHtml(bounds.label) + '</span>' +
    '</div>';

    html += '<div class="stat-grid">' +
      '<div class="stat accent"><div class="st-label">Trabajo</div><div class="st-value">' + fmtDuration(summary.work) + '</div><div class="st-sub">' + plural(workSessions, 'bloque de enfoque', 'bloques de enfoque') + '</div></div>' +
      '<div class="stat"><div class="st-label">Descanso</div><div class="st-value">' + fmtDuration(summary.breaks) + '</div><div class="st-sub">' + plural(breakSessions, 'descanso registrado', 'descansos registrados') + '</div></div>' +
      '<div class="stat"><div class="st-label">Sesiones</div><div class="st-value">' + summary.count + '</div><div class="st-sub">' + workSessions + ' de trabajo · ' + breakSessions + ' de descanso</div></div>' +
      '<div class="stat"><div class="st-label">Días con estudio</div><div class="st-value">' + activeDays + '</div><div class="st-sub">' + (activeDays ? 'Promedio ' + fmtDuration(Math.round(summary.work / activeDays)) + ' al día' : 'Sin actividad todavía') + '</div></div>' +
    '</div>';

    var chart = summaryChart(summary);
    var maxWork = 1;
    chart.forEach(function (item) { if (item.value > maxWork) maxWork = item.value; });
    html += '<div class="card" style="margin-top:14px;">' +
      '<div class="section-head"><div><h2>Trabajo por día</h2><p>Minutos de enfoque registrados</p></div></div>' +
      '<div class="bar-chart">';
    if (!chart.length) {
      html += '<div class="empty-state" style="padding:20px;width:100%;"><p>Aún no hay sesiones en este periodo.</p></div>';
    } else {
      chart.forEach(function (item) {
        var pct = Math.round((item.value / maxWork) * 100);
        html += '<div class="bar-col' + (item.today ? ' today' : '') + '" title="' + fmtDuration(item.value) + '">' +
          '<div class="bar-track"><div class="bar-fill" style="height:' + Math.max(2, pct) + '%"></div></div>' +
          '<span class="bar-value">' + (item.value ? Math.round(item.value / 60) + 'm' : '') + '</span>' +
          '<span class="bar-label">' + escapeHtml(item.label) + '</span>' +
        '</div>';
      });
    }
    html += '</div></div>';

    html += '<div class="settings-grid" style="margin-top:14px;">' +
      '<div class="card"><div class="section-head"><div><h2>Por tarea</h2><p>Tiempo de enfoque acumulado</p></div></div>' + summaryRows(summary.byTaskList, false) + '</div>' +
      '<div class="card"><div class="section-head"><div><h2>Por asignatura</h2><p>Dónde se fue tu tiempo</p></div></div>' + summaryRows(summary.bySubjectList, true) + '</div>' +
    '</div>';

    html += '<div class="card" style="margin-top:14px;">' +
      '<div class="section-head"><div><h2>Historial reciente</h2><p>Últimas sesiones registradas</p></div></div>';
    if (!summary.sessions.length) {
      html += '<div class="empty-state" style="padding:20px;"><div class="es-icon">' + icon('chart') + '</div><strong>Sin sesiones todavía</strong><p>Inicia un pomodoro desde una entrega para empezar a medir tu estudio.</p><button type="button" class="btn btn-primary" data-nav="deadlines">' + icon('deadline') + 'Ir a Entregas</button></div>';
    } else {
      summary.sessions.slice(0, 20).forEach(function (s) {
        var start = parseStamp(s.Start) || new Date();
        var isBreak = String(s.Type).toLocaleLowerCase() === 'descanso';
        html += '<div class="row" style="padding:8px 0;border-bottom:1px solid var(--border);">' +
          '<span class="chip ' + (isBreak ? '' : toneClass(eventTone(s.Subject, 6))) + '">' + (isBreak ? 'Descanso' : 'Trabajo') + '</span>' +
          '<div class="grow"><div class="small bold truncate">' + escapeHtml(s.TaskTitle || (isBreak ? 'Descanso' : 'Sin tarea')) + '</div>' +
          '<div class="tiny subtle">' + escapeHtml(dateMediumCap(start) + ' · ' + fmtTimeDate(start)) + (s.Subject ? ' · ' + escapeHtml(s.Subject) : '') + '</div></div>' +
          '<span class="mono small">' + fmtDuration(s.DurationSeconds) + '</span>' +
        '</div>';
      });
    }
    html += '</div>';
    return html;
  }

  function summaryRows(items, useSubjectTone) {
    if (!items.length) return '<div class="empty-state" style="padding:16px;"><p>Sin datos en este periodo.</p></div>';
    var max = 1;
    items.forEach(function (it) { if (it.work > max) max = it.work; });
    return '<div class="summary-list">' + items.slice(0, 8).map(function (it) {
      var tone = useSubjectTone ? toneFor(it.label) : toneFor(it.detail);
      return '<div class="summary-row">' +
        '<div class="sr-name ' + toneClass(tone) + '"><span class="dot"></span><span class="truncate">' + escapeHtml(it.label) + '</span></div>' +
        '<div class="sr-track"><i style="width:' + Math.max(2, Math.round(it.work / max * 100)) + '%"></i></div>' +
        '<div class="sr-value">' + fmtDuration(it.work) + '</div>' +
      '</div>';
    }).join('') + '</div>';
  }

  /* ------------------------------------------------------------
     Ajustes, respaldos e instalación
     ------------------------------------------------------------ */
  function storageBytes() {
    try { return new Blob([JSON.stringify(data)]).size; } catch (e) { return JSON.stringify(data).length; }
  }

  function renderSettings() {
    var st = data.Settings;
    var bytes = storageBytes();
    var pct = Math.min(100, Math.round(bytes / (5 * 1024 * 1024) * 100));
    var counts = [
      plural(data.Deadlines.length, 'entrega', 'entregas'),
      plural(data.Schedules.length, 'horario', 'horarios'),
      plural(data.Activities.length, 'actividad', 'actividades'),
      plural(data.Sessions.length, 'sesión', 'sesiones'),
      plural(data.PostIts.length, 'nota', 'notas')
    ].join(' · ');

    return '<div class="settings-grid">' +
      '<div class="card">' +
        '<div class="section-head"><div><h2>Pomodoro</h2><p>Duración de los bloques y descansos</p></div></div>' +
        settingNumber('Enfoque', 'Minutos de trabajo por bloque', 'WorkMinutes', st.WorkMinutes, 1, 180) +
        settingNumber('Descanso corto', 'Entre pomodoros', 'ShortBreakMinutes', st.ShortBreakMinutes, 1, 60) +
        settingNumber('Descanso largo', 'Después de varios bloques', 'LongBreakMinutes', st.LongBreakMinutes, 1, 120) +
        settingNumber('Descanso largo cada', 'Número de bloques de enfoque', 'LongBreakEvery', st.LongBreakEvery, 1, 12) +
        settingToggle('Iniciar descanso automáticamente', 'Al terminar un pomodoro', 'AutoStartBreak', st.AutoStartBreak) +
        settingToggle('Iniciar siguiente enfoque automáticamente', 'Al terminar un descanso', 'AutoStartWork', st.AutoStartWork) +
        settingToggle('Notificaciones', 'Avisar al terminar cada fase', 'Notifications', st.Notifications) +
        settingToggle('Sonido', 'Un tono suave al terminar', 'Sound', st.Sound) +
      '</div>' +

      '<div class="card">' +
        '<div class="section-head"><div><h2>Apariencia</h2><p>Elige el ambiente de la aplicación</p></div></div>' +
        '<div class="setting-row"><div class="sr-info"><strong>Tema</strong><span>Galaxia oscura o amanecer cálido</span></div>' +
          '<div class="sr-control"><div class="segmented small">' +
            '<button type="button" data-set-theme="dark" class="' + (data.Theme === 'dark' ? 'active' : '') + '">Oscuro</button>' +
            '<button type="button" data-set-theme="light" class="' + (data.Theme === 'light' ? 'active' : '') + '">Claro</button>' +
          '</div></div>' +
        '</div>' +
        '<div class="setting-row"><div class="sr-info"><strong>Estrellas</strong><span>Deriva lenta y continua, sin parpadeos</span></div><div class="sr-control"><span class="badge success">Activas</span></div></div>' +
        '<div class="setting-row"><div class="sr-info"><strong>Todo local</strong><span>Sin cuentas, sin internet, sin contraseñas</span></div><div class="sr-control">' + icon('check') + '</div></div>' +
      '</div>' +

      '<div class="card span-2">' +
        '<div class="section-head"><div><h2>Tus datos</h2><p>Todo se guarda en este navegador, en este dispositivo</p></div>' +
          '<div class="actions">' +
            '<button type="button" class="btn btn-secondary" data-export>' + icon('download') + 'Exportar respaldo</button>' +
            '<button type="button" class="btn btn-secondary" data-import>' + icon('upload') + 'Importar datos</button>' +
          '</div>' +
        '</div>' +
        '<div class="row wrap" style="margin-bottom:10px;"><span class="small muted">' + escapeHtml(counts) + '</span></div>' +
        '<div class="storage-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="row" style="justify-content:space-between;"><span class="tiny subtle">' + (bytes / 1024).toFixed(1) + ' KB usados de ~5 MB</span><span class="tiny subtle">' + pct + '%</span></div>' +
        '<p class="form-hint" style="margin-top:10px;">El respaldo es un archivo <strong>.json</strong> compatible con la versión de escritorio. Guárdalo en un lugar seguro: si borras los datos del navegador, podrás recuperarlo con «Importar datos».</p>' +
        '<input type="file" id="importFile" accept=".json,application/json" class="hidden">' +
      '</div>' +

      '<div class="card">' +
        '<div class="section-head"><div><h2>Instalar la app</h2><p>Úsala como una aplicación, sin barra del navegador</p></div></div>' +
        '<p class="small muted" style="line-height:1.55;margin:0 0 10px;">En Windows y Android se instala desde el botón. En iPhone debe abrirse primero desde una dirección <strong>https://</strong> en Safari.</p>' +
        '<button type="button" class="btn btn-primary btn-block" data-install-app>' + icon('install') + 'Instalar Enfoque Escolar</button>' +
        '<button type="button" class="btn btn-ghost btn-block" style="margin-top:6px;" data-install-help>Ver instrucciones por dispositivo</button>' +
      '</div>' +

      '<div class="card">' +
        '<div class="section-head"><div><h2>Mantenimiento</h2><p>Borrar todo y empezar de cero</p></div></div>' +
        '<p class="small muted" style="line-height:1.55;margin:0 0 10px;">Antes de borrar, exporta un respaldo. Esta acción elimina entregas, horarios, actividades, notas, sesiones y ajustes de este dispositivo.</p>' +
        '<button type="button" class="btn btn-danger btn-block" data-reset>' + icon('trash') + 'Borrar todos mis datos</button>' +
        '<p class="tiny subtle" style="margin:12px 0 0;">Enfoque Escolar · versión web 1.0 · funciona sin conexión</p>' +
      '</div>' +
    '</div>';
  }

  function settingNumber(label, hint, key, value, min, max) {
    return '<div class="setting-row"><div class="sr-info"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(hint) + '</span></div>' +
      '<div class="sr-control"><input class="num-input" type="number" min="' + min + '" max="' + max + '" value="' + value + '" data-setting="' + key + '"></div></div>';
  }

  function settingToggle(label, hint, key, value) {
    return '<div class="setting-row"><div class="sr-info"><strong>' + escapeHtml(label) + '</strong><span>' + escapeHtml(hint) + '</span></div>' +
      '<div class="sr-control"><label class="switch"><input type="checkbox" data-toggle="' + key + '"' + (value ? ' checked' : '') + '><span class="track"></span></label></div></div>';
  }

  function applySetting(key, value) {
    var st = data.Settings;
    if (key === 'WorkMinutes') st.WorkMinutes = clamp(number(value, 25), 1, 180);
    else if (key === 'ShortBreakMinutes') st.ShortBreakMinutes = clamp(number(value, 5), 1, 60);
    else if (key === 'LongBreakMinutes') st.LongBreakMinutes = clamp(number(value, 15), 1, 120);
    else if (key === 'LongBreakEvery') st.LongBreakEvery = clamp(number(value, 4), 1, 12);
    else if (key === 'AutoStartBreak') st.AutoStartBreak = !!value;
    else if (key === 'AutoStartWork') st.AutoStartWork = !!value;
    else if (key === 'Notifications') {
      st.Notifications = !!value;
      if (st.Notifications && 'Notification' in window && Notification.permission === 'default') {
        try { Notification.requestPermission(); } catch (e) {}
      }
    } else if (key === 'Sound') st.Sound = !!value;
    if (!data.Timer.Active) {
      data.Timer.DurationSeconds = phaseDuration(data.Timer.Phase);
      data.Timer.RemainingSeconds = data.Timer.DurationSeconds;
    }
    save();
  }

  function exportData() {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'enfoque-escolar-respaldo-' + isoDate(new Date()) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(function () { URL.revokeObjectURL(url); }, 3000);
    toast('Respaldo exportado');
  }

  function importFile(file) {
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed;
      try {
        parsed = JSON.parse(String(reader.result || ''));
      } catch (e) {
        toast('El archivo no es un respaldo válido de Enfoque Escolar.', 'danger');
        return;
      }
      if (!parsed || typeof parsed !== 'object') {
        toast('El archivo no contiene datos reconocibles.', 'danger');
        return;
      }
      var next = normalize(parsed);
      askConfirm({
        title: 'Importar datos',
        message: 'Se reemplazarán los datos actuales por los del archivo:<br><strong>' +
          plural(next.Deadlines.length, 'entrega', 'entregas') + ', ' +
          plural(next.Schedules.length, 'horario', 'horarios') + ', ' +
          plural(next.Activities.length, 'actividad', 'actividades') + ', ' +
          plural(next.PostIts.length, 'nota', 'notas') + '</strong>.<br><br>Si quieres conservar lo actual, cancela y exporta primero un respaldo.',
        confirmText: 'Importar y reemplazar',
        danger: false
      }).then(function (ok) {
        if (!ok) return;
        data = next;
        save();
        applyTheme();
        render();
        toast('Datos importados correctamente');
      });
    };
    reader.onerror = function () { toast('No se pudo leer el archivo.', 'danger'); };
    reader.readAsText(file);
  }

  function resetData() {
    askConfirm({
      title: 'Borrar todos mis datos',
      message: 'Se eliminarán <strong>todas</strong> tus entregas, horarios, actividades, notas, sesiones y ajustes de este dispositivo.<br><br>Esta acción no se puede deshacer. ¿Quieres continuar?',
      confirmText: 'Sí, borrar todo',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      data = defaultData();
      save();
      applyTheme();
      render();
      toast('Todos los datos fueron borrados', 'warning');
    });
  }

  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }

  function isIOS() {
    return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isAndroid() {
    return /Android/i.test(navigator.userAgent);
  }

  function updateInstallButtons() {
    var show = !isStandalone() && (!!ui.installPrompt || isIOS() || isAndroid());
    ['installBtn', 'installBtnMobile'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.classList.toggle('hidden', !show);
    });
  }

  function installApp() {
    if (ui.installPrompt) {
      var prompt = ui.installPrompt;
      ui.installPrompt = null;
      prompt.prompt();
      prompt.userChoice.then(function () { updateInstallButtons(); }).catch(function () {});
      return;
    }
    showInstallHelp();
  }

  function showInstallHelp() {
    var body = '<div class="modal-body">' +
      '<p class="confirm-text">Esta app funciona sin conexión y se puede instalar como una aplicación. Elige tu dispositivo:</p>' +
      '<div><strong>Windows (Chrome o Edge)</strong><ol class="install-steps"><li>Abre la app en <strong>Chrome</strong> o <strong>Edge</strong>.</li><li>Pulsa el icono <strong>Instalar</strong> en la barra de direcciones o el botón «Instalar Enfoque Escolar».</li><li>Confirma. Se abrirá en su propia ventana.</li></ol></div>' +
      '<div><strong>Android (Chrome)</strong><ol class="install-steps"><li>Abre la app en <strong>Chrome</strong>.</li><li>Menú <strong>⋮</strong> → <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma.</li></ol></div>' +
      '<div><strong>iPhone o iPad (Safari)</strong><ol class="install-steps"><li>La app debe estar publicada en una dirección <strong>https://</strong> (por ejemplo, Netlify Drop o GitHub Pages).</li><li>Abre esa dirección en <strong>Safari</strong>.</li><li>Toca <strong>Compartir</strong> (cuadrado con flecha) → <strong>Añadir a pantalla de inicio</strong>.</li><li>Confirma con <strong>Añadir</strong>.</li></ol></div>' +
      '<p class="form-hint">En la computadora, si abres los archivos directamente con doble clic (<strong>file://</strong>), la app funciona pero no se puede instalar ni guardar el modo sin conexión. Usa el servidor local <strong>servir.ps1</strong> o una dirección https.</p>' +
    '</div>' +
    '<div class="modal-foot"><button type="button" class="btn btn-primary" data-modal-close>Entendido</button></div>';
    openModal({ title: 'Cómo instalar la app', subtitle: 'Windows · Android · iPhone', body: body });
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'http:' && location.protocol !== 'https:') return;
    navigator.serviceWorker.register('sw.js').catch(function () { /* sin conexión no disponible */ });
  }

  /* ------------------------------------------------------------
     Eventos
     ------------------------------------------------------------ */
  function findDeadline(id) { return data.Deadlines.filter(function (d) { return d.Id === id; })[0]; }

  document.addEventListener('click', function (e) {
    var target = e.target;
    var el;

    if ((el = target.closest('[data-nav]'))) { setPage(el.getAttribute('data-nav')); return; }
    if (target.closest('#themeBtn') || target.closest('#themeBtnMobile')) { toggleTheme(); return; }
    if (target.closest('#installBtn') || target.closest('#installBtnMobile') || target.closest('[data-install-app]')) { installApp(); return; }
    if (target.closest('[data-install-help]')) { showInstallHelp(); return; }
    if (target.closest('[data-modal-close]')) { closeModal(); return; }

    if ((el = target.closest('[data-tlview]'))) { ui.tlView = el.getAttribute('data-tlview'); render(); return; }
    if (target.closest('[data-tlprev]')) {
      if (ui.tlView === 'day') ui.tlDate = addDays(ui.tlDate, -1);
      else if (ui.tlView === 'week') ui.tlDate = addDays(ui.tlDate, -7);
      else ui.tlDate = new Date(ui.tlDate.getFullYear(), ui.tlDate.getMonth() - 1, 1);
      render(); return;
    }
    if (target.closest('[data-tlnext]')) {
      if (ui.tlView === 'day') ui.tlDate = addDays(ui.tlDate, 1);
      else if (ui.tlView === 'week') ui.tlDate = addDays(ui.tlDate, 7);
      else ui.tlDate = new Date(ui.tlDate.getFullYear(), ui.tlDate.getMonth() + 1, 1);
      render(); return;
    }
    if (target.closest('[data-tltoday]')) { ui.tlDate = startOfDay(new Date()); render(); return; }
    if ((el = target.closest('[data-goday]'))) {
      ui.tlDate = parseDateOnly(el.getAttribute('data-goday')) || new Date();
      ui.tlView = 'day';
      render();
      var view = document.getElementById('view'); if (view) view.scrollTop = 0;
      return;
    }

    if (target.closest('[data-new-deadline]')) { openDeadlineDialog(null); return; }
    if (target.closest('[data-new-schedule]')) { openScheduleDialog(null); return; }
    if (target.closest('[data-new-activity]')) { openActivityDialog(null); return; }
    if (target.closest('[data-new-postit]')) { openPostItDialog(null); return; }

    if ((el = target.closest('[data-edit-deadline]'))) { openDeadlineDialog(el.getAttribute('data-edit-deadline')); return; }
    if ((el = target.closest('[data-edit-schedule]'))) { openScheduleDialog(el.getAttribute('data-edit-schedule')); return; }
    if ((el = target.closest('[data-edit-activity]'))) { openActivityDialog(el.getAttribute('data-edit-activity')); return; }
    if ((el = target.closest('[data-edit-postit]'))) { openPostItDialog(el.getAttribute('data-edit-postit')); return; }

    if ((el = target.closest('[data-delete-deadline]'))) { deleteDeadline(el.getAttribute('data-delete-deadline')); return; }
    if ((el = target.closest('[data-delete-schedule]'))) { deleteSchedule(el.getAttribute('data-delete-schedule')); return; }
    if ((el = target.closest('[data-delete-activity]'))) { deleteActivity(el.getAttribute('data-delete-activity')); return; }
    if ((el = target.closest('[data-delete-postit]'))) { deletePostIt(el.getAttribute('data-delete-postit')); return; }

    if ((el = target.closest('[data-toggle-deadline]'))) { toggleDeadline(el.getAttribute('data-toggle-deadline')); return; }
    if ((el = target.closest('[data-pomodoro]'))) { startPomodoroForDeadline(el.getAttribute('data-pomodoro')); return; }
    if (target.closest('[data-pomo-pick]')) { closeModal(); setPage('deadlines'); return; }
    if (target.closest('[data-pomo-open]')) { openPomodoroPanel(); return; }
    if (target.closest('[data-pomo-toggle]')) { toggleTimer(); return; }
    if (target.closest('[data-pomo-stop]')) { stopTimer(true); closeModal(); return; }

    if ((el = target.closest('[data-dfilter]'))) { ui.deadlineFilter = number(el.getAttribute('data-dfilter'), 0); render(); return; }
    if ((el = target.closest('[data-range]'))) { ui.summaryRange = number(el.getAttribute('data-range'), 0); render(); return; }

    if ((el = target.closest('[data-day-pick]'))) { el.classList.toggle('on'); return; }
    if ((el = target.closest('[data-tone-pick]'))) {
      var wrap = el.parentNode;
      wrap.querySelectorAll('[data-tone-pick]').forEach(function (b) { b.classList.remove('active'); });
      el.classList.add('active');
      return;
    }

    if ((el = target.closest('[data-postit-item-del]'))) {
      deletePostItItem(el.getAttribute('data-postit-item-del'), number(el.getAttribute('data-item-index'), 0));
      return;
    }
    if ((el = target.closest('[data-set-theme]'))) {
      data.Theme = el.getAttribute('data-set-theme') === 'light' ? 'light' : 'dark';
      save(); applyTheme(); render(); return;
    }
    if (target.closest('[data-export]')) { exportData(); return; }
    if (target.closest('[data-import]')) {
      var input = document.getElementById('importFile');
      if (input) input.click();
      return;
    }
    if (target.closest('[data-reset]')) { resetData(); return; }

    if (target.closest('#miniTimer')) { openPomodoroPanel(); return; }
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (el.matches('[data-postit-item]')) {
      togglePostItItem(el.getAttribute('data-postit-item'), number(el.getAttribute('data-item-index'), 0), el.checked);
      return;
    }
    if (el.matches('[data-setting]')) { applySetting(el.getAttribute('data-setting'), el.value); render(); return; }
    if (el.matches('[data-toggle]')) { applySetting(el.getAttribute('data-toggle'), el.checked); render(); return; }
    if (el.id === 'importFile' && el.files && el.files[0]) {
      importFile(el.files[0]);
      el.value = '';
      return;
    }
    if (el.name === 'allDay') {
      var form = el.closest('form');
      var time = form && form.querySelector('[name="dueTime"]');
      if (time) time.disabled = el.checked;
    }
  });

  document.addEventListener('input', function (e) {
    if (e.target.id === 'deadlineSearch') {
      ui.deadlineQuery = e.target.value;
      refreshDeadlineList();
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.matches('form[data-form]') && !form.matches('[data-postit-add]')) return;
    e.preventDefault();
    if (form.matches('[data-postit-add]')) {
      var noteId = form.getAttribute('data-postit-add');
      var input = form.querySelector('input');
      addPostItItem(noteId, input.value);
      input.value = '';
      return;
    }
    var kind = form.getAttribute('data-form');
    if (kind === 'deadline') saveDeadlineForm(form);
    else if (kind === 'schedule') saveScheduleForm(form);
    else if (kind === 'activity') saveActivityForm(form);
    else if (kind === 'postit') savePostItForm(form);
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (ui.modal) { closeModal(); return; }
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLocaleLowerCase() === 'n' && !ui.modal) {
      e.preventDefault();
      openDeadlineDialog(null);
    }
  });

  function pageFromHash() {
    var hash = String(location.hash || '').replace(/^#/, '').toLowerCase();
    if (hash === 'deadlines' || hash === 'entregas') return 'deadlines';
    if (hash === 'schedules' || hash === 'horarios') return 'schedules';
    if (hash === 'postits' || hash === 'pendientes') return 'postits';
    if (hash === 'summary' || hash === 'resumen') return 'summary';
    if (hash === 'settings' || hash === 'ajustes') return 'settings';
    return '';
  }

  function applyHash() {
    var page = pageFromHash();
    if (!page) return;
    ui.page = page;
    render();
  }

  /* ------------------------------------------------------------
     Arranque
     ------------------------------------------------------------ */
  function init() {
    data = loadData();
    applyTheme();
    initSky();
    render();
    applyHash();
    tickClock();
    window.setInterval(tickClock, 1000);
    recoverTimer();
    registerServiceWorker();

    window.addEventListener('hashchange', applyHash);

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      ui.installPrompt = e;
      updateInstallButtons();
    });
    window.addEventListener('appinstalled', function () {
      ui.installPrompt = null;
      updateInstallButtons();
      toast('Enfoque Escolar se instaló correctamente');
    });
    updateInstallButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
