
"use strict";

/* ==================================
   FEECOLLECT - DATA AND UTILITIES
================================== */

const STORAGE_KEY = "feecollect_system_v2";

const paymentSuccessSound = new Audio("./sounds/kaching.mp3");

let data = loadData();
let toastTimeout;

/* ==================================
   DATA STORAGE
================================== */

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      const parsed = JSON.parse(saved);

      if (
        parsed &&
        Array.isArray(parsed.students) &&
        Array.isArray(parsed.collections) &&
        Array.isArray(parsed.payments)
      ) {
        return {
          students: parsed.students,
          collections: parsed.collections,
          payments: parsed.payments
        };
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

/* ==================================
   GENERAL UTILITIES
================================== */

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
  const amount = Number(value);

  return (Number.isFinite(amount) ? amount : 0).toLocaleString("en-PH", {
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

  const parts = String(value).split("-");

  if (parts.length !== 3) {
    return escapeHTML(value);
  }

  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function showToast(message, isError = false) {
  const toast = document.getElementById("toast");

  if (!toast) return;

  toast.textContent = message;
  toast.classList.toggle("error", isError);
  toast.classList.add("show");

  clearTimeout(toastTimeout);

  toastTimeout = setTimeout(() => {
    toast.classList.remove("show");
  }, 3500);
}

/* ==================================
   RECORD LOOKUP AND CALCULATIONS
================================== */

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
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
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
    .reduce((total, payment) => total + Number(payment.amount || 0), 0);
}

function isCollectionActive(collection) {
  return !collection.dueDate || collection.dueDate >= today();
}

function receiptNumber(payment) {
  return payment.receipt || payment.id || "—";
}

/* ==================================
   NAVIGATION
================================== */

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

  document.querySelectorAll(".page").forEach(page => {
    page.classList.remove("active-page");
  });

  selectedPage.classList.add("active-page");

  document.querySelectorAll(".nav-button[data-page]").forEach(button => {
    button.classList.toggle("active", button.dataset.page === pageId);
  });

  const title = document.getElementById("pageTitle");

  if (title && pageTitles[pageId]) {
    title.textContent = pageTitles[pageId];
  }

  renderAll();

  window.scrollTo(0, 0);
}

document.querySelectorAll(".nav-button[data-page]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.page);
  });
});

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => {
    showPage(button.dataset.go);
  });
});

/* ==================================
   FORM SHOW / HIDE
================================== */

function toggleForm(formId, show) {
  const form = document.getElementById(formId);

  if (form) {
    form.classList.toggle("hidden", !show);
  }
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
    String(student.id).toLowerCase() === id.toLowerCase()
  );

  if (duplicate) {
    showToast("That student ID already exists.", true);
    return;
  }

  const student = {
    id,
    name,
    section,
    createdAt: today()
  };

  data.students.push(student);

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
    !student.archived && (
      String(student.id).toLowerCase().includes(search) ||
      String(student.name).toLowerCase().includes(search) ||
      String(student.section || "").toLowerCase().includes(search)
    )
  );

  const archivedStudents = data.students.filter(student =>
    student.archived
  );

  document.getElementById("studentCount").textContent =
    `${students.length} student${students.length === 1 ? "" : "s"}`;

  const tbody = document.getElementById("studentsTable");

  if (!students.length) {
    tbody.innerHTML =
      `<tr><td colspan="4">No student records found.</td></tr>`;
  } else {
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
            ${
              hasPayments
                ? `<button class="secondary" data-archive-student="${escapeHTML(student.id)}">Archive</button>`
                : `<button class="danger" data-delete-student="${escapeHTML(student.id)}">Delete</button>`
            }
          </td>
        </tr>
      `;
    }).join("");
  }

  const archivedBody = document.getElementById("archivedStudentsTable");

  if (!archivedStudents.length) {
    archivedBody.innerHTML =
      `<tr><td colspan="4">No archived students.</td></tr>`;
  } else {
    archivedBody.innerHTML = archivedStudents.map(student => `
      <tr>
        <td>${escapeHTML(student.id)}</td>
        <td>${escapeHTML(student.name)}</td>
        <td>${escapeHTML(student.section || "—")}</td>
        <td>
          <button class="secondary" data-restore-student="${escapeHTML(student.id)}">
            Restore
          </button>
        </td>
      </tr>
    `).join("");
  }
}

document.getElementById("studentSearch").addEventListener("input", renderStudents);

document.getElementById("studentsTable").addEventListener("click", event => {
  const archiveButton = event.target.closest("[data-archive-student]");
  const deleteButton = event.target.closest("[data-delete-student]");

  if (archiveButton) {
    const id = archiveButton.dataset.archiveStudent;
    const student = studentById(id);

    if (!student || student.archived) return;

    if (!confirm(`Archive student "${student.name}"?`)) return;

    student.archived = true;

    if (!saveData()) {
      student.archived = false;
      return;
    }

    renderAll();
    showToast("Student archived successfully.");
    return;
  }

  if (deleteButton) {
    const id = deleteButton.dataset.deleteStudent;
    const student = studentById(id);

    if (!student) return;

    if (data.payments.some(payment => payment.studentId === id)) {
      showToast("Students with payment records cannot be deleted.", true);
      return;
    }

    if (!confirm(`Delete student "${student.name}"?`)) return;

    const previousStudents = data.students;
    data.students = data.students.filter(item => item.id !== id);

    if (!saveData()) {
      data.students = previousStudents;
      return;
    }

    renderAll();
    showToast("Student record deleted.");
  }
});

document.getElementById("archivedStudentsTable").addEventListener("click", event => {
  const restoreButton = event.target.closest("[data-restore-student]");

  if (!restoreButton) return;

  const id = restoreButton.dataset.restoreStudent;
  const student = studentById(id);

  if (!student || !student.archived) return;

  if (!confirm(`Restore student "${student.name}"?`)) return;

  student.archived = false;

  if (!saveData()) {
    student.archived = true;
    return;
  }

  renderAll();
  showToast("Student restored successfully.");
});

/* ==================================
   FEE COLLECTIONS
================================== */

document.getElementById("collectionForm").addEventListener("submit", event => {
  event.preventDefault();

  const name = document.getElementById("collectionName").value.trim();
  const amount = Number(document.getElementById("collectionAmount").value);
  const dueDate = document.getElementById("collectionDue").value;

  if (!name || !Number.isFinite(amount) || amount <= 0 || !dueDate) {
    showToast("Enter a collection name, valid amount, and due date.", true);
    return;
  }

  const collection = {
    id: "COL-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    name,
    amount,
    dueDate,
    createdAt: today()
  };

  data.collections.push(collection);

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

  const activeCollections = data.collections.filter(
    collection => !collection.archived
  );

  const archivedCollections = data.collections.filter(
    collection => collection.archived
  );

  if (!activeCollections.length) {
    tbody.innerHTML =
      `<tr><td colspan="6">No active collections. Create a new collection.</td></tr>`;
  } else {
    tbody.innerHTML = activeCollections.map(collection => {
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
            <button class="small-button"
              data-pay-collection="${escapeHTML(collection.id)}"
              ${!active ? "disabled" : ""}>
              Record Payment
            </button>

            ${
              hasPayments
                ? `<button class="secondary" data-archive-collection="${escapeHTML(collection.id)}">Archive</button>`
                : `<button class="danger" data-delete-collection="${escapeHTML(collection.id)}">Delete</button>`
            }
          </td>
        </tr>
      `;
    }).join("");
  }

  const archivedBody = document.getElementById("archivedCollectionsTable");

  if (!archivedCollections.length) {
    archivedBody.innerHTML =
      `<tr><td colspan="4">No archived collections.</td></tr>`;
  } else {
    archivedBody.innerHTML = archivedCollections.map(collection => `
      <tr>
        <td>${escapeHTML(collection.name)}</td>
        <td>${money(collection.amount)}</td>
        <td>${formatDate(collection.dueDate)}</td>
        <td>
          <button class="secondary"
            data-restore-collection="${escapeHTML(collection.id)}">
            Restore
          </button>
        </td>
      </tr>
    `).join("");
  }
}

document.getElementById("collectionsTable").addEventListener("click", event => {
  const payButton = event.target.closest("[data-pay-collection]");
  const archiveButton = event.target.closest("[data-archive-collection]");
  const deleteButton = event.target.closest("[data-delete-collection]");

  // Record Payment
  if (payButton) {
    const id = payButton.dataset.payCollection;
    const collection = collectionById(id);

    if (!collection || collection.archived || !isCollectionActive(collection)) {
      showToast("This collection is not available for payment.", true);
      return;
    }

    showPage("payments");

    document.getElementById("paymentCollection").value = id;
    updatePaymentInfo();

    return;
  }

  // Archive Collection
  if (archiveButton) {
    const id = archiveButton.dataset.archiveCollection;
    const collection = collectionById(id);

    if (!collection || collection.archived) return;

    if (!confirm(`Archive collection "${collection.name}"?`)) return;

    collection.archived = true;

    if (!saveData()) {
      collection.archived = false;
      return;
    }

    renderAll();
    showToast("Collection archived successfully.");
    return;
  }

  // Delete Collection
  if (deleteButton) {
    const id = deleteButton.dataset.deleteCollection;
    const collection = collectionById(id);

    if (!collection) return;

    if (data.payments.some(payment => payment.collectionId === id)) {
      showToast("Collections with payment records cannot be deleted.", true);
      return;
    }

    if (!confirm(`Delete collection "${collection.name}"?`)) return;

    const previousCollections = data.collections;

    data.collections = data.collections.filter(item => item.id !== id);

    if (!saveData()) {
      data.collections = previousCollections;
      return;
    }

    renderAll();
    showToast("Collection deleted.");
  }
});

// Restore Archived Collections
document.getElementById("archivedCollectionsTable").addEventListener("click", event => {
  const restoreButton = event.target.closest("[data-restore-collection]");

  if (!restoreButton) return;

  const id = restoreButton.dataset.restoreCollection;
  const collection = collectionById(id);

  if (!collection || !collection.archived) return;

  if (!confirm(`Restore collection "${collection.name}"?`)) return;

  collection.archived = false;

  if (!saveData()) {
    collection.archived = true;
    return;
  }

  renderAll();
  showToast("Collection restored successfully.");
});

/* ==================================
   PAYMENT FORM
================================== */

function populatePaymentOptions() {
  const studentSelect = document.getElementById("paymentStudent");
  const collectionSelect = document.getElementById("paymentCollection");

  const previousStudent = studentSelect.value;
  const previousCollection = collectionSelect.value;

  // Active Students
  studentSelect.innerHTML =
    `<option value="">Select a student</option>` +
    data.students
      .filter(student => !student.archived)
      .map(student => `
        <option value="${escapeHTML(student.id)}">
          ${escapeHTML(student.id)} — ${escapeHTML(student.name)}
        </option>
      `).join("");

  // Active, Non-Archived Collections
  collectionSelect.innerHTML =
    `<option value="">Select a collection</option>` +
    data.collections
      .filter(collection =>
        !collection.archived && isCollectionActive(collection)
      )
      .map(collection => `
        <option value="${escapeHTML(collection.id)}">
          ${escapeHTML(collection.name)} — ${money(collection.amount)}
        </option>
      `).join("");

  // Restore Previous Selections
  if (data.students.some(student =>
    student.id === previousStudent && !student.archived
  )) {
    studentSelect.value = previousStudent;
  }

  if (data.collections.some(collection =>
    collection.id === previousCollection &&
    !collection.archived &&
    isCollectionActive(collection)
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

  if (!studentId || !collectionId) {
    info.textContent = "Select a student and collection to view the balance.";
    updateCashDisplay();
    return;
  }

  const student = studentById(studentId);
  const collection = collectionById(collectionId);

  if (!student || !collection) {
    info.textContent = "Student or collection record unavailable.";
    updateCashDisplay();
    return;
  }

  const paid = paidFor(studentId, collectionId);
  const balance = balanceFor(studentId, collectionId);

  info.innerHTML = `
    <strong>Student:</strong> ${escapeHTML(student.name)}<br>
    <strong>Fee:</strong> ${money(collection.amount)}<br>
    <strong>Previously Paid:</strong> ${money(paid)}<br>
    <strong>Remaining Balance:</strong> ${money(balance)}
  `;

  updateCashDisplay();
}

/* ==================================
   CASH RECEIVED AND CHANGE DISPLAY
================================== */

function updateCashDisplay() {
  const cashReceivedInput = document.getElementById("cashReceived");

  const displayPaymentAmount = document.getElementById("displayPaymentAmount");
  const displayCashReceived = document.getElementById("displayCashReceived");
  const displayChange = document.getElementById("displayChange");

  const studentId = document.getElementById("paymentStudent").value;
  const collectionId = document.getElementById("paymentCollection").value;

  const cash = Number(cashReceivedInput.value);

  const balance = studentId && collectionId
    ? balanceFor(studentId, collectionId)
    : 0;

  const hasCash = cashReceivedInput.value.trim() !== "";
  const validCash = hasCash && Number.isFinite(cash) && cash > 0;

  const amount = validCash ? Math.min(cash, balance) : 0;
  const change = validCash ? Math.max(0, cash - amount) : 0;

  displayPaymentAmount.textContent = money(amount);
  displayCashReceived.textContent = money(validCash ? cash : 0);
  displayChange.textContent = money(change);
}

document.getElementById("cashReceived")
  .addEventListener("input", updateCashDisplay);

/* ==================================
   RECORD PAYMENT
================================== */

document.getElementById("paymentForm").addEventListener("submit", event => {
  event.preventDefault();

  const studentId = document.getElementById("paymentStudent").value;
  const collectionId = document.getElementById("paymentCollection").value;
  const cashReceived = Number(document.getElementById("cashReceived").value);
  const date = document.getElementById("paymentDate").value;
  const notes = document.getElementById("paymentNotes").value.trim();

  if (!studentId || !collectionId) {
    showToast("Select a student and collection.", true);
    return;
  }

  if (!date) {
    showToast("Enter the payment date.", true);
    return;
  }

  if (date > today()) {
    showToast("The payment date cannot be in the future.", true);
    return;
  }

  if (!Number.isFinite(cashReceived) || cashReceived <= 0) {
    showToast("Enter a valid cash amount.", true);
    return;
  }

  const student = studentById(studentId);
  const collection = collectionById(collectionId);

  if (!student || student.archived) {
    showToast("This student is unavailable.", true);
    return;
  }

  if (!collection || collection.archived || !isCollectionActive(collection)) {
    showToast("This collection is unavailable.", true);
    return;
  }

  const balance = balanceFor(studentId, collectionId);

  if (balance <= 0) {
    showToast("This student has already paid the full amount.", true);
    return;
  }

  // Automatically calculate the payment amount and change.
  const amount = Math.min(cashReceived, balance);
  const change = Math.max(0, cashReceived - amount);

  const payment = {
    id: "PAY-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
    receipt: "FC-" + Date.now(),
    studentId,
    collectionId,
    amount: Math.round(amount * 100) / 100,
    cashReceived: Math.round(cashReceived * 100) / 100,
    change: Math.round(change * 100) / 100,
    date,
    notes,
    createdAt: new Date().toISOString()
  };

  data.payments.push(payment);

  if (!saveData()) {
    data.payments.pop();
    return;
  }

  // Clear cash and notes after successful recording.
  document.getElementById("cashReceived").value = "";
  document.getElementById("paymentNotes").value = "";

  // Refresh all records.
  renderAll();

  // Preserve the current student and collection selections.
  document.getElementById("paymentStudent").value = studentId;
  document.getElementById("paymentCollection").value = collectionId;

  updatePaymentInfo();
  updateCashDisplay();

  // Play success sound.
  paymentSuccessSound.currentTime = 0;

  paymentSuccessSound.play().catch(error => {
    console.warn("Could not play payment success sound:", error);
  });

  // Generate receipt.
  showReceipt(payment.id);

  showToast("Payment recorded. Receipt generated.");
});

/* ==================================
   RECEIPTS
================================== */

function showReceipt(paymentId) {
  const payment = data.payments.find(item => item.id === paymentId);

  if (!payment) {
    showToast("Payment record not found.", true);
    return;
  }

  const student = studentById(payment.studentId);
  const collection = collectionById(payment.collectionId);

  if (!student || !collection) {
    showToast("Student or collection record unavailable.", true);
    return;
  }

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
        <span>Amount Paid</span>
        <strong>${money(payment.amount)}</strong>
      </div>

      <div class="receipt-line">
        <span>Cash Received</span>
        <strong>${money(payment.cashReceived ?? payment.amount)}</strong>
      </div>

      <div class="receipt-line">
        <span>Change</span>
        <strong>${money(payment.change ?? 0)}</strong>
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
        <button class="primary" id="printReceipt">
          Print Receipt
        </button>

        <button class="secondary" id="closeReceipt">
          Close
        </button>
      </div>

    </div>
  `;

  // PRINT RECEIPT BUTTON
  document.getElementById("printReceipt").addEventListener("click", () => {
    window.print();
  });

  // CLOSE RECEIPT BUTTON
  document.getElementById("closeReceipt").addEventListener("click", () => {
    area.classList.add("hidden");
  });

  area.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// View receipt from Payment History.
document.getElementById("historyTable").addEventListener("click", event => {
  const button = event.target.closest("[data-print-payment]");

  if (!button) return;

  showPage("payments");
  showReceipt(button.dataset.printPayment);
});

/* ==================================
   PAYMENT HISTORY
================================== */

function renderHistory() {
  const search = document.getElementById("historySearch")
    .value.trim().toLowerCase();

  const payments = [...data.payments]
    .sort((a, b) =>
      String(b.createdAt || b.date || "")
        .localeCompare(String(a.createdAt || a.date || ""))
    )
    .filter(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      const searchable = [
        receiptNumber(payment),
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
    tbody.innerHTML =
      `<tr><td colspan="6">No payment records found.</td></tr>`;
    return;
  }

  tbody.innerHTML = payments.map(payment => {
    const student = studentById(payment.studentId);
    const collection = collectionById(payment.collectionId);

    return `
      <tr>
        <td>${escapeHTML(receiptNumber(payment))}</td>
        <td>${formatDate(payment.date)}</td>
        <td>${escapeHTML(student?.name || "Student record unavailable")}</td>
        <td>${escapeHTML(collection?.name || "Collection unavailable")}</td>
        <td><strong>${money(payment.amount)}</strong></td>
        <td>
          <button class="small-button"
            data-print-payment="${escapeHTML(payment.id)}">
            View Receipt
          </button>
        </td>
      </tr>
    `;
  }).join("");
}

document.getElementById("historySearch")
  .addEventListener("input", renderHistory);

/* ==================================
   CSV EXPORT
================================== */

document.getElementById("exportCsv").addEventListener("click", () => {
  if (!data.payments.length) {
    showToast("There are no payments to export.", true);
    return;
  }

  const csvEscape = value => {
    let text = String(value ?? "");

    // Protect spreadsheet applications from interpreting text as formulas.
    if (/^[=+\-@\t\r]/.test(text)) {
      text = "'" + text;
    }

    return `"${text.replace(/"/g, '""')}"`;
  };

  const rows = [
    [
      "Receipt No.",
      "Date",
      "Student ID",
      "Student Name",
      "Course / Section",
      "Collection",
      "Fee Amount",
      "Amount Paid",
      "Cash Received",
      "Change",
      "Remaining Balance",
      "Notes"
    ]
  ];

  [...data.payments]
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .forEach(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      rows.push([
        receiptNumber(payment),
        payment.date,
        student?.id || "",
        student?.name || "",
        student?.section || "",
        collection?.name || "",
        collection?.amount ?? "",
        payment.amount,
        payment.cashReceived ?? payment.amount,
        payment.change ?? 0,
        balanceFor(payment.studentId, payment.collectionId),
        payment.notes || ""
      ]);
    });

  const csv = rows
    .map(row => row.map(csvEscape).join(","))
    .join("\r\n");

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
  const activeStudents = data.students.filter(
    student => !student.archived
  );

  const activeCollections = data.collections.filter(
    collection => !collection.archived
  );

  const totalCollected = data.payments.reduce(
    (total, payment) => total + Number(payment.amount || 0),
    0
  );

  const totalBalance = activeCollections.reduce((total, collection) => {
    return total + activeStudents.reduce((studentTotal, student) => {
      return studentTotal + balanceFor(student.id, collection.id);
    }, 0);
  }, 0);

  document.getElementById("statStudents").textContent =
    activeStudents.length;

  document.getElementById("statCollections").textContent =
    activeCollections.filter(isCollectionActive).length;

  document.getElementById("statCollected").textContent =
    money(totalCollected);

  document.getElementById("statBalance").textContent =
    money(totalBalance);

  // Recent Collections
  const collectionsBody = document.getElementById("dashboardCollections");

  const recentCollections = [...activeCollections]
    .sort((a, b) =>
      String(b.createdAt || "").localeCompare(String(a.createdAt || ""))
    )
    .slice(0, 5);

  if (!recentCollections.length) {
    collectionsBody.innerHTML =
      `<tr><td colspan="4">No active collections yet.</td></tr>`;
  } else {
    collectionsBody.innerHTML = recentCollections.map(collection => `
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

  // Recent Payments
  const paymentsBody = document.getElementById("dashboardPayments");

  const recentPayments = [...data.payments]
    .sort((a, b) =>
      String(b.createdAt || b.date || "")
        .localeCompare(String(a.createdAt || a.date || ""))
    )
    .slice(0, 5);

  if (!recentPayments.length) {
    paymentsBody.innerHTML =
      `<tr><td colspan="5">No payments recorded yet.</td></tr>`;
  } else {
    paymentsBody.innerHTML = recentPayments.map(payment => {
      const student = studentById(payment.studentId);
      const collection = collectionById(payment.collectionId);

      return `
        <tr>
          <td>${escapeHTML(receiptNumber(payment))}</td>
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

/* ==================================
   ARCHIVED PANEL VISIBILITY
================================== */

document.getElementById("viewArchivedCollections").addEventListener("click", () => {
  document.getElementById("archivedCollectionsPanel")
    .classList.remove("hidden");
});

document.getElementById("hideArchivedCollections").addEventListener("click", () => {
  document.getElementById("archivedCollectionsPanel")
    .classList.add("hidden");
});

document.getElementById("viewArchivedStudents").addEventListener("click", () => {
  document.getElementById("archivedStudentsPanel")
    .classList.remove("hidden");
});

document.getElementById("hideArchivedStudents").addEventListener("click", () => {
  document.getElementById("archivedStudentsPanel")
    .classList.add("hidden");
});

/* ==================================
   MOBILE HAMBURGER MENU
================================== */

const hamburgerMenu = document.getElementById("hamburgerMenu");
const sidebarOverlay = document.getElementById("sidebarOverlay");

function openMobileMenu() {
  document.body.classList.add("menu-open");
  hamburgerMenu.setAttribute("aria-expanded", "true");
}

function closeMobileMenu() {
  document.body.classList.remove("menu-open");
  hamburgerMenu.setAttribute("aria-expanded", "false");
}

hamburgerMenu.addEventListener("click", () => {
  if (document.body.classList.contains("menu-open")) {
    closeMobileMenu();
  } else {
    openMobileMenu();
  }
});

sidebarOverlay.addEventListener("click", closeMobileMenu);

document.querySelectorAll(".sidebar .nav-button").forEach(button => {
  button.addEventListener("click", closeMobileMenu);
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeMobileMenu();
  }
});

/* ==================================
   INITIAL DISPLAY
================================== */

renderAll();
showPage("dashboard");
