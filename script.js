
"use strict";

/* ==================================
   FEECOLLECT - DATA AND UTILITIES
================================== */

const STORAGE_KEY = "feecollect_system_v2";

let data = loadData();
let toastTimeout;

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (
        Array.isArray(parsed.students) &&
        Array.isArray(parsed.collections) &&
        Array.isArray(parsed.payments)
      ) {
        return parsed;
      }
    }
  } catch (error) {
    console.error("Could not load saved data:", error);
  }

  return {
    students: [],
    collections: [],
    payments: []
  };
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error("Could not save data:", error);
    showToast("Unable to save data. Check your browser storage.", true);
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function money(value) {
  return Number(value || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP"
  });
}

function today() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDate(value) {
  if (!value) return "—";

  const parts = value.split("-");

  if (parts.length !== 3) return escapeHTML(value);

  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

function studentById(id) {
  return data.students.find(student => student.id === id);
}

function collectionById(id) {
  return data.collections.find(collection => collection.id === id);
}

function paymentsFor(studentId, collectionId) {
  return data.payments.filter(payment =>
    payment.studentId === studentId &&
    payment.collectionId === collectionId
  );
}

function paidFor(studentId, collectionId) {
  return paymentsFor(studentId, collectionId)
    .reduce((total, payment) => total + Number(payment.amount), 0);
}

function balanceFor(studentId, collectionId) {
  const collection = collectionById(collectionId);

  if (!collection) return 0;

  return Math.max(
    0,
    Number(collection.amount) - paidFor(studentId, collectionId)
  );
}

function totalCollectedForCollection(collectionId) {
  return data.payments
    .filter(payment => payment.collectionId === collectionId)
    .reduce((total, payment) => total + Number(payment.amount), 0);
}

function isCollectionActive(collection) {
  return !collection.dueDate || collection.dueDate >= today();
}

function receiptNumber(payment) {
  return payment.receipt;
}

/* ==================================
   NAVIGATION
================================== */


/* WORKING PAGE NAVIGATION */

const pageTitles = {
  dashboard: "Dashboard",
  collections: "Collections",
  students: "Students",
  payments: "Record Payment",
  history: "Payment History"
};

function showPage(pageId) {
  const selectedPage = document.getElementById(pageId);

  if (!selectedPage) {
    console.error("Page not found:", pageId);
    return;
  }

  // Hide all pages
  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  // Show the selected page
  selectedPage.classList.add("active-page");

  // Update the sidebar highlight
  document.querySelectorAll(".nav-button[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  // Update the heading
  const title = document.getElementById("pageTitle");

  if (title && pageTitles[pageId]) {
    title.textContent = pageTitles[pageId];
  }

  // Refresh page content when changing pages
  if (typeof renderAll === "function") {
    renderAll();
  }

  window.scrollTo(0, 0);
}

// Sidebar navigation
document.querySelectorAll(".nav-button[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

// Dashboard shortcut buttons
document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});


/* ==================================
   FORM SHOW / HIDE
================================== */

function toggleForm(formId, show) {
  document.getElementById(formId).classList.toggle("hidden", !show);
}

document.getElementById("showStudentForm").addEventListener("click", () => {
  toggleForm("studentForm", true);
  document.getElementById("studentId").focus();
});

document.getElementById("cancelStudent").addEventListener("click", () => {
  document.getElementById("studentForm").reset();
  toggleForm("studentForm", false);
});

document.getElementById("showCollectionForm").addEventListener("click", () => {
  toggleForm("collectionForm", true);
  document.getElementById("collectionName").focus();
});

document.getElementById("cancelCollection").addEventListener("click", () => {
  document.getElementById("collectionForm").reset();
  toggleForm("collectionForm", false);
});

/* ==================================
   STUDENT RECORDS
================================== */

document.getElementById("studentForm").addEventListener("submit", event => {
  event.preventDefault();

  const id = document.getElementById("studentId").value.trim();
  const name = document.getElementById("studentName").value.trim();
  const section = document.getElementById("studentSection").value.trim();

  if (!id || !name) {
    showToast("Enter the student ID and full name.", true);
    return;
  }

  const duplicate = data.students.some(student =>
    student.id.toLowerCase() === id.toLowerCase()
  );

  if (duplicate) {
    showToast("That student ID already exists.", true);
    return;
  }

  data.students.push({
    id,
    name,
    section,
    createdAt: today()
  });

  if (!saveData()) {
    data.students.pop();
    return;
  }

  event.target.reset();
  toggleForm("studentForm", false);

  renderAll();
  showToast("Student record saved successfully.");
});

function renderStudents() {
  const search = document.getElementById("studentSearch")
    .value.trim().toLowerCase();

  const students = data.students.filter(student =>
    student.id.toLowerCase().includes(search) ||
    student.name.toLowerCase().includes(search) ||
    student.section.toLowerCase().includes(search)
  );

  document.getElementById("studentCount").textContent =
    `${students.length} student${students.length === 1 ? "" : "s"}`;

  const tbody = document.getElementById("studentsTable");

  if (!students.length) {
    tbody.innerHTML = `<tr><td colspan="4">No student records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = students.map(student => {
    const hasPayments = data.payments.some(
      payment => payment.studentId === student.id
    );

    return `
      <tr>
        <td>${escapeHTML(student.id)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.section || "—")}</td>
        <td>
          <button class="danger" data-delete-student="${escapeHTML(student.id)}"
            ${hasPayments ? "disabled title='Student has payment records'" : ""}>
            Delete
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("studentSearch").addEventListener("input", renderStudents);

document.getElementById("studentsTable").addEventListener("click", event => {
  const button = event.target.closest("[data-delete-student]");
  if (!button) return;

  const id = button.dataset.deleteStudent;
  const student = studentById(id);

  if (!student) return;

  if (data.payments.some(payment => payment.studentId === id)) {
    showToast("Students with payment records cannot be deleted.", true);
    return;
  }

  if (!confirm(`Delete student "${student.name}"?`)) return;

  data.students = data.students.filter(item => item.id !== id);

  if (!saveData()) return;

  renderAll();
  showToast("Student record deleted.");
});

/* ==================================
   FEE COLLECTIONS
================================== */

document.getElementById("collectionForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("collectionName").value.trim();
  const amount = Number(document.getElementById("collectionAmount").value);
  const dueDate = document.getElementById("collectionDue").value;

  if (!name || !Number.isFinite(amount) || amount <= 0) {
    showToast("Enter a collection name and a valid amount.", true);
    return;
  }

  data.collections.push({
    id: "COL-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    name,
    amount,
    dueDate,
    createdAt: today()
  });

  if (!saveData()) {
    data.collections.pop();
    return;
  }

  event.target.reset();
  toggleForm("collectionForm", false);

  renderAll();
  showToast("Collection created successfully.");
});

function renderCollections() {
  const tbody = document.getElementById("collectionsTable");

  if (!data.collections.length) {
    tbody.innerHTML = `<tr><td colspan="6">No collections yet. Create your first collection.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.collections.map(collection => {
    const collected = totalCollectedForCollection(collection.id);
    const active = isCollectionActive(collection);
    const hasPayments = data.payments.some(
      payment => payment.collectionId === collection.id
    );

    return `
      <tr>
        <td><strong>${escapeHTML(collection.name)}</strong></td>
        <td>${money(collection.amount)}</td>
        <td>${formatDate(collection.dueDate)}</td>
        <td>${money(collected)}</td>
        <td>
          <span class="status ${active ? "" : "closed"}">
            ${active ? "Active" : "Past Due"}
          </span>
        </td>
        <td>
          <button class="small-button" data-pay-collection="${escapeHTML(collection.id)}"
            ${!active ? "disabled" : ""}>Record Payment</button>
          <button class="danger" data-delete-collection="${escapeHTML(collection.id)}"
            ${hasPayments ? "disabled title='Collection has payment records'" : ""}>Delete</button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("collectionsTable").addEventListener("click", event => {
  const payButton = event.target.closest("[data-pay-collection]");
  const deleteButton = event.target.closest("[data-delete-collection]");

  if (payButton) {
    showPage("payments");
    document.getElementById("paymentCollection").value =
      payButton.dataset.payCollection;
    updatePaymentInfo();
    return;
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteCollection;
    const collection = collectionById(id);

    if (!collection) return;

    if (data.payments.some(payment => payment.collectionId === id)) {
      showToast("Collections with payment records cannot be deleted.", true);
      return;
    }

    if (!confirm(`Delete collection "${collection.name}"?`)) return;

    data.collections = data.collections.filter(item => item.id !== id);

    if (!saveData()) return;

    renderAll();
    showToast("Collection deleted.");
  }
});

/* ==================================
   PAYMENT FORM
================================== */

function populatePaymentOptions() {
  const studentSelect = document.getElementById("paymentStudent");
  const collectionSelect = document.getElementById("paymentCollection");

  const previousStudent = studentSelect.value;
  const previousCollection = collectionSelect.value;

  studentSelect.innerHTML =
    `<option value="">Select a student</option>` +
    data.students.map(student => `
      <option value="${escapeHTML(student.id)}">
        ${escapeHTML(student.id)} — ${escapeHTML(student.name)}
      </option>
    `).join("");

  collectionSelect.innerHTML =
    `<option value="">Select a collection</option>` +
    data.collections.filter(isCollectionActive).map(collection => `
      <option value="${escapeHTML(collection.id)}">
        ${escapeHTML(collection.name)} — ${money(collection.amount)}
      </option>
    `).join("");

  if (data.students.some(student => student.id === previousStudent)) {
    studentSelect.value = previousStudent;
  }

  if (data.collections.some(collection =>
    collection.id === previousCollection && isCollectionActive(collection)
  )) {
    collectionSelect.value = previousCollection;
  }
}

document.getElementById("paymentDate").value = today();

document.getElementById("paymentStudent").addEventListener("change", updatePaymentInfo);
document.getElementById("paymentCollection").addEventListener("change", updatePaymentInfo);

function updatePaymentInfo() {
  const studentId = document.getElementById("paymentStudent").value;
  const collectionId = document.getElementById("paymentCollection").value;
  const info = document.getElementById("paymentInfo");
  const amountInput = document.getElementById("paymentAmount");

  if (!studentId || !collectionId) {
    info.textContent = "Select a student and collection to view the balance.";
    amountInput.removeAttribute("max");
    return;
  }

  const student = studentById(studentId);
  const collection = collectionById(collectionId);

  if (!student || !collection) return;

  const paid = paidFor(studentId, collectionId);
  const balance = balanceFor(studentId, collectionId);

  info.innerHTML = `
    <strong>Student:</strong> ${escapeHTML(student.name)}<br>
    <strong>Fee:</strong> ${money(collection.amount)}<br>
    <strong>Previously Paid:</strong> ${money(paid)}<br>
    <strong>Remaining Balance:</strong> ${money(balance)}
  `;

  amountInput.max = balance.toFixed(2);
  amountInput.placeholder = balance > 0 ? `Up to ${balance.toFixed(2)}` : "Fully paid";
}

document.getElementById("paymentForm").addEventListener("submit", event => {
  event.preventDefault();

  const studentId = document.getElementById("paymentStudent").value;
  const collectionId = document.getElementById("paymentCollection").value;
  const amount = Number(document.getElementById("paymentAmount").value);
  const date = document.getElementById("paymentDate").value;
  const notes = document.getElementById("paymentNotes").value.trim();

  const student = studentById(studentId);
  const collection = collectionById(collectionId);

  if (!student || !collection) {
    showToast("Select a valid student and fee collection.", true);
    return;
  }

  if (!isCollectionActive(collection)) {
    showToast("This collection is past its due date.", true);
    return;
  }

  if (!Number.isFinite(amount) || amount <= 0 || !date) {
    showToast("Enter a valid payment amount and date.", true);
    return;
  }

  if (date > today()) {
    showToast("The payment date cannot be in the future.", true);
    return;
  }

  const balance = balanceFor(studentId, collectionId);

  if (balance <= 0) {
    showToast("This student has already paid the full amount.", true);
    return;
  }

  if (amount > balance + 0.000001) {
    showToast(`Payment cannot exceed the remaining balance of ${money(balance)}.`, true);
    return;
  }

  const payment = {
    id: "PAY-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    receipt: "FC-" + Date.now(),
    studentId,
    collectionId,
    amount: Math.round(amount * 100) / 100,
    date,
    notes,
    createdAt: new Date().toISOString()
  };

  data.payments.push(payment);

  if (!saveData()) {
    data.payments.pop();
    return;
  }

  document.getElementById("paymentAmount").value = "";
  document.getElementById("paymentNotes").value = "";

  renderAll();
  populatePaymentOptions();
  document.getElementById("paymentStudent").value = studentId;
  document.getElementById("paymentCollection").value = collectionId;
  updatePaymentInfo();

  showReceipt(payment.id);
  showToast("Payment recorded. Receipt generated.");
});

/* ==================================
   RECEIPTS
================================== */

function showReceipt(paymentId) {
  const payment = data.payments.find(item => item.id === paymentId);
  if (!payment) return;

  const student = studentById(payment.studentId);
  const collection = collectionById(payment.collectionId);

  if (!student || !collection) return;

  const paid = paidFor(payment.studentId, payment.collectionId);
  const balance = balanceFor(payment.studentId, payment.collectionId);

  const area = document.getElementById("receiptArea");
  area.classList.remove("hidden");

  area.innerHTML = `
    <div class="receipt">
      <h2>FeeCollect</h2>
      <h3>PAYMENT RECEIPT</h3>
      <p style="text-align:center;margin:8px 0 20px">
        Keep this receipt as proof of payment.
      </p>

      <div class="receipt-line">
        <span>Receipt Number</span>
        <strong>${escapeHTML(receiptNumber(payment))}</strong>
      </div>
      <div class="receipt-line">
        <span>Date of Payment</span>
        <strong>${formatDate(payment.date)}</strong>
      </div>
      <div class="receipt-line">
        <span>Student ID</span>
        <strong>${escapeHTML(student.id)}</strong>
      </div>
      <div class="receipt-line">
        <span>Student Name</span>
        <strong>${escapeHTML(student.name)}</strong>
      </div>
      <div class="receipt-line">
        <span>Course / Section</span>
        <strong>${escapeHTML(student.section || "—")}</strong>
      </div>
      <div class="receipt-line">
        <span>Fee Collection</span>
        <strong>${escapeHTML(collection.name)}</strong>
      </div>
      <div class="receipt-line">
        <span>Fee Amount</span>
        <strong>${money(collection.amount)}</strong>
      </div>
      <div class="receipt-line">
        <span>Amount Received</span>
        <strong>${money(payment.amount)}</strong>
      </div>
      <div class="receipt-line">
        <span>Total Paid for this Fee</span>
        <strong>${money(paid)}</strong>
      </div>
      <div class="receipt-line">
        <span>Remaining Balance</span>
        <strong>${money(balance)}</strong>
      </div>
      ${payment.notes ? `
        <div class="receipt-line">
          <span>Notes</span>
          <span>${escapeHTML(payment.notes)}</span>
        </div>
      ` : ""}

      <p style="text-align:center;margin-top:24px;font-size:12px">
        Thank you. Please keep this receipt for your records.
      </p>

      <div class="receipt-actions">
        <button class="primary" id="printReceipt">Print Receipt</button>
        <button class="secondary" id="closeReceipt">Close</button>
      </div>
    </div>
  `;

  document.getElementById("printReceipt").addEventListener("click", () => {
    window.print();
  });

  document.getElementById("closeReceipt").addEventListener("click", () => {
    area.classList.add("hidden");
  });

  area.scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("historyTable").addEventListener("click", event => {
  const button = event.target.closest("[data-print-payment]");
  if (!button) return;

  showPage("payments");
  showReceipt(button.dataset.printPayment);
});

/* ==================================
   PAYMENT HISTORY AND CSV EXPORT
================================== */

function renderHistory() {
  const search = document.getElementById("historySearch")
    .value.trim().toLowerCase();

  const payments = [...data.payments]
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
    .filter(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      const searchable = [
        payment.receipt,
        payment.date,
        student?.id,
        student?.name,
        collection?.name,
        payment.amount
      ].join(" ").toLowerCase();

      return searchable.includes(search);
    });

  document.getElementById("historyCount").textContent =
    `${payments.length} payment${payments.length === 1 ? "" : "s"}`;

  const tbody = document.getElementById("historyTable");

  if (!payments.length) {
    tbody.innerHTML = `<tr><td colspan="6">No payment records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(payment => {
    const student = studentById(payment.studentId);
    const collection = collectionById(payment.collectionId);

    return `
      <tr>
        <td>${escapeHTML(payment.receipt)}</td>
        <td>${formatDate(payment.date)}</td>
        <td>${escapeHTML(student?.name || "Student record unavailable")}</td>
        <td>${escapeHTML(collection?.name || "Collection unavailable")}</td>
        <td><strong>${money(payment.amount)}</strong></td>
        <td>
          <button class="small-button" data-print-payment="${escapeHTML(payment.id)}">
            View Receipt
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("historySearch").addEventListener("input", renderHistory);

document.getElementById("exportCsv").addEventListener("click", () => {
  if (!data.payments.length) {
    showToast("There are no payments to export.", true);
    return;
  }

  const csvEscape = value => {
    let text = String(value ?? "");

    // Protect spreadsheet applications from interpreting text as formulas.
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;

    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = [
    ["Receipt No.", "Date", "Student ID", "Student Name",
      "Course / Section", "Collection", "Fee Amount", "Amount Paid", "Remaining Balance", "Notes"]
  ];

  [...data.payments]
    .sort((a, b) => a.date.localeCompare(b.date))
    .forEach(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      rows.push([
        payment.receipt,
        payment.date,
        student?.id || "",
        student?.name || "",
        student?.section || "",
        collection?.name || "",
        collection?.amount ?? "",
        payment.amount,
        balanceFor(payment.studentId, payment.collectionId),
        payment.notes || ""
      ]);
    });

  const csv = rows.map(row => row.map(csvEscape).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;"
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `FeeCollect-Payments-${today()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  showToast("Payment history exported to CSV.");
});

/* ==================================
   DASHBOARD
================================== */

function renderDashboard() {
  const totalCollected = data.payments.reduce(
    (total, payment) => total + Number(payment.amount), 0
  );

  const totalBalance = data.collections.reduce((total, collection) => {
    return total + data.students.reduce((studentTotal, student) => {
      return studentTotal + balanceFor(student.id, collection.id);
    }, 0);
  }, 0);

  document.getElementById("statStudents").textContent = data.students.length;

  document.getElementById("statCollections").textContent =
    data.collections.filter(isCollectionActive).length;

  document.getElementById("statCollected").textContent = money(totalCollected);
  document.getElementById("statBalance").textContent = money(totalBalance);

  const collectionsBody = document.getElementById("dashboardCollections");

  if (!data.collections.length) {
    collectionsBody.innerHTML =
      `<tr><td colspan="4">No collections yet. Create one in Collections.</td></tr>`;
  } else {
    collectionsBody.innerHTML = [...data.collections]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 5)
      .map(collection => `
        <tr>
          <td>${escapeHTML(collection.name)}</td>
          <td>${money(collection.amount)}</td>
          <td>${money(totalCollectedForCollection(collection.id))}</td>
          <td>
            <span class="status ${isCollectionActive(collection) ? "" : "closed"}">
              ${isCollectionActive(collection) ? "Active" : "Past Due"}
            </span>
          </td>
        </tr>
      `).join("");
  }

  const paymentsBody = document.getElementById("dashboardPayments");

  const recentPayments = [...data.payments]
    .sort((a, b) => (b.createdAt || b.date).localeCompare(a.createdAt || a.date))
    .slice(0, 5);

  if (!recentPayments.length) {
    paymentsBody.innerHTML = `<tr><td colspan="5">No payments recorded yet.</td></tr>`;
  } else {
    paymentsBody.innerHTML = recentPayments.map(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      return `
        <tr>
          <td>${escapeHTML(payment.receipt)}</td>
          <td>${escapeHTML(student?.name || "Unavailable")}</td>
          <td>${escapeHTML(collection?.name || "Unavailable")}</td>
          <td>${money(payment.amount)}</td>
          <td>${formatDate(payment.date)}</td>
        </tr>
      `;
    }).join("");
  }
}

/* ==================================
   REFRESH ALL PAGES
================================== */

function renderAll() {
  renderDashboard();
  renderStudents();
  renderCollections();
  renderHistory();
  populatePaymentOptions();
  updatePaymentInfo();
}

// Initial display
renderAll();
showPage("dashboard");
