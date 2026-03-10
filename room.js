document.querySelectorAll(".sidebar li[data-page]").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(`page-${page}`).classList.add("active");

        sidebar.classList.add("closed");
    });
});

document.getElementById("page-home").classList.add("active");

const sidebar = document.getElementById("sidebar");
const toggleBtn = document.getElementById("toggleSidebar");

// 初期状態は閉じている
sidebar.classList.add("closed");

// ボタンを押したら開く
toggleBtn.addEventListener("click", () => {
    sidebar.classList.remove("closed");
});

// サイドバー以外をクリックしたら閉じる
document.addEventListener("click", (e) => {
    if (!sidebar.contains(e.target) && e.target !== toggleBtn) {
        sidebar.classList.add("closed");
    }
});

// ★ サイドバーの項目をクリックしたら閉じる
document.querySelectorAll(".sidebar li[data-page]").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(`page-${page}`).classList.add("active");

        // ← これが重要！
        sidebar.classList.add("closed");
    });
});

/* Firebase 設定（budgetbook-202603） */
const firebaseConfig = {
    apiKey: "AIzaSyCwnHl8gFx8ctkpJ8m_HZOw-dGkSMdIf8M",
    authDomain: "budgetbook-202603.firebaseapp.com",
    projectId: "budgetbook-202603",
    storageBucket: "budgetbook-202603.firebasestorage.app",
    messagingSenderId: "1016406574750",
    appId: "1:1016406574750:web:c27a0b3ada3f4496a99d8f"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();


/* ------------------------------
   Firestore 参照
------------------------------ */
const params = new URLSearchParams(location.search);
const roomId = params.get("id") || "default";

const [year, month] = roomId.split("-");
document.title = `${year}年${month}月家計簿`;

const fixedDoc = db.collection("households").doc("fixed");
const variableDoc = db.collection("rooms").doc(roomId);

let fixedItems = [];
let variableItems = [];

/* ------------------------------
   初期読み込み（固定費・変動費）
------------------------------ */
async function loadData() {
    const fixedSnap = await fixedDoc.get();
    fixedItems = fixedSnap.exists ? fixedSnap.data().fixedItems : [];

    const variableSnap = await variableDoc.get();
    variableItems = variableSnap.exists ? variableSnap.data().variableItems : [];

    // ページが表示されたときに描画されるのでここでは描画しない
}
loadData();

/* ============================================================
   変動費ページ 初期化
============================================================ */
function initVariablePage() {
    if (window.variablePageInitialized) return;
    window.variablePageInitialized = true;

    console.log("変動費ページ 初期化");

    /* ------------------------------
       コンボボックス
    ------------------------------ */
    const itemNameInput = document.getElementById("itemName");
    const comboList = document.getElementById("comboList");

    itemNameInput.addEventListener("focus", () => {
        comboList.style.display = "block";
    });

    comboList.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("option")) {
            itemNameInput.value = e.target.textContent;
        }
    });

    itemNameInput.addEventListener("blur", () => {
        setTimeout(() => comboList.style.display = "none", 100);
    });

    /* ------------------------------
       変動費描画
    ------------------------------ */
    const itemList = document.getElementById("itemList");

    function renderVariable() {
        itemList.innerHTML = "";
        variableItems.forEach((item, idx) => {
            const li = document.createElement("li");
            li.classList.add("variable-item");
            li.dataset.index = idx;
            li.innerHTML = `
                <span>${item.name}：${item.amount.toLocaleString()} 円</span>
                <span class="actions">
                    <button class="editBtn">編集</button>
                    <button class="deleteBtn">削除</button>
                </span>
            `;
            itemList.appendChild(li);
        });

        recalcTotal();
        updateShareText();
    }

    /* ------------------------------
       変動費追加
    ------------------------------ */
    document.getElementById("addBtn").onclick = async () => {
        const name = document.getElementById("itemName").value.trim();
        const amount = Number(document.getElementById("itemAmount").value);

        if (!name || !amount) return;

        variableItems.push({ name, amount });
        await variableDoc.set({ variableItems });
        renderVariable();

        document.getElementById("itemName").value = "";
        document.getElementById("itemAmount").value = "";
    };

    /* ------------------------------
       変動費 編集・削除
    ------------------------------ */
    itemList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const index = Number(li.dataset.index);
        const item = variableItems[index];

        if (e.target.classList.contains("editBtn")) {
            li.innerHTML = `
                <div class="edit-area">
                    <input type="text" class="editName" value="${item.name}">
                    <input type="number" class="editAmount" value="${item.amount}">
                </div>
            `;

            const editArea = li.querySelector(".edit-area");
            const nameInput = li.querySelector(".editName");
            const amountInput = li.querySelector(".editAmount");

            amountInput.focus();
            amountInput.select();

            const saveEdit = async () => {
                item.name = nameInput.value;
                item.amount = Number(amountInput.value);
                await variableDoc.set({ variableItems });
                renderVariable();
            };

            nameInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });
            amountInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });

            editArea.addEventListener("focusout", (ev) => {
                if (editArea.contains(ev.relatedTarget)) return;
                saveEdit();
            });

            return;
        }

        if (e.target.classList.contains("deleteBtn")) {
            variableItems.splice(index, 1);
            await variableDoc.set({ variableItems });
            renderVariable();
        }
    };

    /* ------------------------------
       合計
    ------------------------------ */
    function recalcTotal() {
        const total = [...variableItems, ...fixedItems]
            .reduce((sum, item) => sum + item.amount, 0);

        document.getElementById("totalAmount").textContent =
            `${total.toLocaleString()} 円`;
    }

    /* ------------------------------
       共有テキスト
    ------------------------------ */
    function updateShareText() {
        let text = `【${year}年${month}月の家計簿まとめ】\n`;
        text += "-------------------------\n";

        text += "~~変動費~~\n";
        if (variableItems.length === 0) {
            text += "（なし）\n";
        } else {
            variableItems.forEach(i => {
                text += `${i.name}：${i.amount.toLocaleString()}円\n`;
            });
        }

        text += "\n~~固定費~~\n";
        fixedItems.forEach(i => {
            text += `${i.name}：${i.amount.toLocaleString()}円\n`;
        });

        const total = [...variableItems, ...fixedItems]
            .reduce((sum, item) => sum + item.amount, 0);

        text += `\n合計：${total.toLocaleString()}円`;

        document.getElementById("shareText").value = text;
    }

    /* ------------------------------
       コピー
    ------------------------------ */
    copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(shareText.value)
            .then(() => {
                copyBtn.textContent = "コピーしました！";
                setTimeout(() => {
                    copyBtn.textContent = "コピーする";
                }, 1500);
            });
    });

    // 初回描画
    renderVariable();
}

/* ============================================================
   固定費ページ 初期化
============================================================ */
function initFixedPage() {
    if (window.fixedPageInitialized) return;
    window.fixedPageInitialized = true;

    console.log("固定費ページ 初期化");

    const fixedList = document.getElementById("fixedList");

    function renderFixed() {
        fixedList.innerHTML = "";
        fixedItems.forEach((item, idx) => {
            const li = document.createElement("li");
            li.classList.add("fixed-item");
            li.dataset.index = idx;
            li.innerHTML = `
                <span>${item.name}：${item.amount.toLocaleString()} 円</span>
                <span class="actions">
                    <button class="editBtn">編集</button>
                    <button class="deleteBtn">削除</button>
                </span>
            `;
            fixedList.appendChild(li);
        });
    }

    document.getElementById("fixedAddBtn").onclick = async () => {
        const name = document.getElementById("fixedName").value.trim();
        const amount = Number(document.getElementById("fixedAmount").value);

        if (!name || !amount) return;

        fixedItems.push({ name, amount });
        await fixedDoc.set({ fixedItems });
        renderFixed();
    };

    fixedList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const index = Number(li.dataset.index);
        const item = fixedItems[index];

        if (e.target.classList.contains("editBtn")) {
            li.innerHTML = `
                <div class="edit-area">
                    <input type="text" class="editName" value="${item.name}">
                    <input type="number" class="editAmount" value="${item.amount}">
                </div>
            `;

            const editArea = li.querySelector(".edit-area");
            const nameInput = li.querySelector(".editName");
            const amountInput = li.querySelector(".editAmount");

            amountInput.focus();
            amountInput.select();

            const saveEdit = async () => {
                item.name = nameInput.value;
                item.amount = Number(amountInput.value);
                await fixedDoc.set({ fixedItems });
                renderFixed();
            };

            nameInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });
            amountInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });

            editArea.addEventListener("focusout", (ev) => {
                if (editArea.contains(ev.relatedTarget)) return;
                saveEdit();
            });

            return;
        }

        if (e.target.classList.contains("deleteBtn")) {
            fixedItems.splice(index, 1);
            await fixedDoc.set({ fixedItems });
            renderFixed();
        }
    };

    renderFixed();
}

/* ============================================================
   ページ切り替え
============================================================ */
document.querySelectorAll(".sidebar li[data-page]").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const targetPage = document.getElementById(`page-${page}`);
        targetPage.classList.add("active");

        sidebar.classList.add("closed");

        if (page === "expense-list") initVariablePage();
        if (page === "fixed-edit") initFixedPage();
    });
});
