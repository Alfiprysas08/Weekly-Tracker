// =========================
// KONFIGURASI FIREBASE (REALTIME DATABASE)
// =========================

const firebaseConfig = {
  apiKey: "AIzaSyDO71WskoF_eB1tl3JjjnhGbldsJyvG4uE",
  authDomain: "weeklytracker-160c6.firebaseapp.com",
  databaseURL: "https://weeklytracker-160c6-default-rtdb.firebaseio.com",
  projectId: "weeklytracker-160c6",
  storageBucket: "weeklytracker-160c6.appspot.com",
  messagingSenderId: "1003431531876",
  appId: "1:1003431531876:web:92d4bde5fa7ace2463d671",
  measurementId: "G-WF2TYKCVNV"
};

// Inisialisasi Firebase & Realtime Database
firebase.initializeApp(firebaseConfig);
const db = firebase.database();

// =========================
// KONSTAN
// =========================
const CATEGORIES = ["Primary", "Academy", "Development", "Socio"];
const TIMES_OF_DAY = ["Subuh", "Pagi", "Sore", "Malam"];
const DAYS_OF_WEEK = ["Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

const categoryToContainerId = {
  Primary: "primary-list",
  Academy: "academy-list",
  Development: "development-list",
  Socio: "socio-list"
};

// State di memori
let currentTasks = [];
let currentSchedule = [];

// =========================
// INISIALISASI SETELAH DOM SIAP
// =========================
document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initHeroButtonJump();
  initTaskForm();
  initScheduleForm();
  renderEmptyScheduleGrid();

  subscribeToTasks();
  subscribeToSchedule();
});

// =========================
// NAVIGASI TAB
// =========================
function initTabs() {
  const navButtons = document.querySelectorAll(".nav-link");
  const sections = document.querySelectorAll(".tab-content");

  navButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.tab;

      navButtons.forEach((b) => b.classList.remove("active"));
      sections.forEach((sec) => sec.classList.remove("active"));

      btn.classList.add("active");
      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.classList.add("active");
      }
    });
  });
}

// Tombol di hero yang lompat ke tab Task
function initHeroButtonJump() {
  document.querySelectorAll("[data-tab-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetTab = btn.dataset.tabJump;
      const navButton = document.querySelector(
        `.nav-link[data-tab="${targetTab}"]`
      );
      if (navButton) {
        navButton.click();
      }
    });
  });
}

// =========================
// FORM TASK
// =========================
function initTaskForm() {
  const form = document.getElementById("task-form");
  const titleInput = document.getElementById("task-title");
  const categorySelect = document.getElementById("task-category");

  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const title = titleInput.value.trim();
    const category = categorySelect.value;

    if (!title || !category) {
      alert("Isi nama task dan pilih kategori dulu ya.");
      return;
    }

    try {
      const newTaskRef = db.ref("tasks").push();
      await newTaskRef.set({
        title,
        category,
        status: "pending",
        createdAt: Date.now()
      });

      form.reset();
    } catch (error) {
      console.error("Gagal menambahkan task:", error);
      alert(
        "Gagal menyimpan task ke Realtime Database. Cek console kalau mau debugging."
      );
    }
  });
}

// =========================
// REALTIME LISTENER: TASKS
// =========================
function subscribeToTasks() {
  db.ref("tasks").on(
    "value",
    (snapshot) => {
      const data = snapshot.val() || {};
      currentTasks = [];

      Object.keys(data).forEach((key) => {
        currentTasks.push({ id: key, ...data[key] });
      });

      // Urutkan berdasarkan createdAt
      currentTasks.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      renderTasks();
      renderTaskSelectOptions();
      renderDashboard();
    },
    (error) => {
      console.error("Error mengambil tasks:", error);
    }
  );
}

// Render task ke kolomnya
function renderTasks() {
  // Kosongkan semua list
  Object.values(categoryToContainerId).forEach((id) => {
    const container = document.getElementById(id);
    if (container) container.innerHTML = "";
  });

  // Render per task
  currentTasks.forEach((task) => {
    const containerId = categoryToContainerId[task.category];
    const container = document.getElementById(containerId);
    if (!container) return;

    const card = document.createElement("div");
    card.className = "task-card";
    if (task.status === "done") card.classList.add("done");

    card.innerHTML = `
      <div class="task-title">${escapeHtml(task.title)}</div>
      <div class="task-actions">
        <button class="btn-small btn-outline" data-action="toggle" data-id="${task.id}">
          ${task.status === "done" ? "Ulangi" : "Selesai"}
        </button>
        <button class="btn-small btn-danger" data-action="delete" data-id="${task.id}">
          Hapus
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  // Event listener untuk tombol (toggle & delete)
  document.querySelectorAll(".task-actions button").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const action = btn.dataset.action;
      const task = currentTasks.find((t) => t.id === id);
      if (!task) return;

      if (action === "toggle") {
        try {
          const newStatus = task.status === "done" ? "pending" : "done";
          await db.ref("tasks").child(id).update({ status: newStatus });
        } catch (error) {
          console.error("Gagal mengubah status task:", error);
        }
      } else if (action === "delete") {
        const sure = confirm(
          "Yakin ingin menghapus task ini? Task juga akan dihapus dari jadwal."
        );
        if (!sure) return;

        try {
          // Hapus semua schedule yang memakai taskId ini
          const scheduleRef = db.ref("schedule");
          const snap = await scheduleRef
            .orderByChild("taskId")
            .equalTo(id)
            .once("value");

          const updates = {};
          snap.forEach((child) => {
            updates[child.key] = null; // hapus node
          });

          if (Object.keys(updates).length > 0) {
            await scheduleRef.update(updates);
          }

          await db.ref("tasks").child(id).remove();
        } catch (error) {
          console.error("Gagal menghapus task:", error);
        }
      }
    };
  });
}

// =========================
// SELECT TASK UNTUK WEEKLY TRACKER
// =========================
function renderTaskSelectOptions() {
  const select = document.getElementById("schedule-task");
  if (!select) return;

  select.innerHTML = `<option value="">-- Pilih Task dari Daftar --</option>`;

  currentTasks.forEach((task) => {
    const opt = document.createElement("option");
    opt.value = task.id;
    opt.textContent = `[${task.category}] ${task.title}`;
    select.appendChild(opt);
  });
}

// =========================
// FORM SCHEDULE
// =========================
function initScheduleForm() {
  const form = document.getElementById("schedule-form");
  if (!form) return;

  const daySelect = document.getElementById("schedule-day");
  const timeSelect = document.getElementById("schedule-time");
  const taskSelect = document.getElementById("schedule-task");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const day = daySelect.value;
    const time = timeSelect.value;
    const taskId = taskSelect.value;

    if (!day || !time || !taskId) {
      alert("Pilih hari, waktu, dan task dulu ya.");
      return;
    }

    const task = currentTasks.find((t) => t.id === taskId);
    if (!task) {
      alert("Task tidak ditemukan. Coba muat ulang halaman.");
      return;
    }

    try {
      const newScheduleRef = db.ref("schedule").push();
      await newScheduleRef.set({
        day,
        time,
        taskId,
        taskTitle: task.title,
        category: task.category,
        createdAt: Date.now()
      });

      timeSelect.value = "";
      taskSelect.value = "";
    } catch (error) {
      console.error("Gagal menyimpan jadwal:", error);
      alert("Gagal menyimpan ke Realtime Database.");
    }
  });
}

// =========================
// REALTIME LISTENER: SCHEDULE
// =========================
function subscribeToSchedule() {
  db.ref("schedule").on(
    "value",
    (snapshot) => {
      const data = snapshot.val() || {};
      currentSchedule = [];

      Object.keys(data).forEach((key) => {
        currentSchedule.push({ id: key, ...data[key] });
      });

      currentSchedule.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));

      renderScheduleTable();
    },
    (error) => {
      console.error("Error mengambil data schedule:", error);
    }
  );
}

// Buat grid kosong
function renderEmptyScheduleGrid() {
  const tbody = document.getElementById("schedule-body");
  if (!tbody) return;

  tbody.innerHTML = "";

  TIMES_OF_DAY.forEach((time) => {
    const tr = document.createElement("tr");

    const th = document.createElement("th");
    th.textContent = time;
    tr.appendChild(th);

    DAYS_OF_WEEK.forEach((day) => {
      const td = document.createElement("td");
      td.dataset.day = day;
      td.dataset.time = time;
      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });
}

// Isi grid dengan data schedule
function renderScheduleTable() {
  renderEmptyScheduleGrid();
  const tbody = document.getElementById("schedule-body");
  if (!tbody) return;

  currentSchedule.forEach((entry) => {
    const selector = `td[data-day="${entry.day}"][data-time="${entry.time}"]`;
    const cell = tbody.querySelector(selector);
    if (!cell) return;

    const item = document.createElement("div");
    item.className = "schedule-item";

    item.innerHTML = `
      <span class="schedule-task-title">${escapeHtml(entry.taskTitle)}</span>
      <button class="btn-icon" data-id="${entry.id}" title="Hapus dari jadwal">✕</button>
    `;

    cell.appendChild(item);
  });

  // Tombol hapus di setiap item jadwal
  tbody.querySelectorAll(".schedule-item .btn-icon").forEach((btn) => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      try {
        await db.ref("schedule").child(id).remove();
      } catch (error) {
        console.error("Gagal menghapus jadwal:", error);
      }
    };
  });
}

// =========================
// DASHBOARD
// =========================
function renderDashboard() {
  const total = currentTasks.length;
  const done = currentTasks.filter((t) => t.status === "done").length;
  const pending = total - done;

  const totalEl = document.getElementById("stat-total");
  const doneEl = document.getElementById("stat-done");
  const pendingEl = document.getElementById("stat-pending");

  if (totalEl) totalEl.textContent = total;
  if (doneEl) doneEl.textContent = done;
  if (pendingEl) pendingEl.textContent = pending;

  const list = document.getElementById("dashboard-task-list");
  if (!list) return;
  list.innerHTML = "";

  currentTasks.forEach((task) => {
    const li = document.createElement("li");
    li.className = "dashboard-task-item";
    if (task.status === "done") li.classList.add("done");

    const statusClass = task.status === "done" ? "badge-success" : "badge-warning";
    const statusText = task.status === "done" ? "Selesai" : "Belum";

    li.innerHTML = `
      <span>[${task.category}] ${escapeHtml(task.title)}</span>
      <span class="badge ${statusClass}">${statusText}</span>
    `;

    list.appendChild(li);
  });
}

// =========================
// UTIL
// =========================
function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
