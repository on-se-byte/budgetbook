// ------------------------------
// サイドバー切り替え
// ------------------------------
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

// ★ サイドバーの項目をクリックしたら閉じる（ページ切り替えは後ろで再定義）
document.querySelectorAll(".sidebar li[data-page]").forEach(item => {
    item.addEventListener("click", () => {
        const page = item.dataset.page;

        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        document.getElementById(`page-${page}`).classList.add("active");

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

// ▼ 固定費テンプレート（共通）
const fixedTemplateDoc = db.collection("households").doc("fixedTemplate");

// ▼ 貯金テンプレート（共通）
const savingTemplateDoc = db.collection("households").doc("savingTemplate");

// ▼ 月ごとのデータ
const monthDoc = db.collection("rooms").doc(roomId);

let incomeItems = {
    omame: [],
    ikkun: []
};
let fixedItems = [];
let variableItems = [];
let savingItems = {
    household: [],
    omame: [],
    ikkun: []
};

/* ============================================================
   合計 & 共有テキスト & 変動費描画（どこからでも呼べるように外出し）
============================================================ */
function recalcTotal() {
    const total = [
        ...variableItems,
        ...fixedItems,
        // ...savingItems   // ★ 貯金も合計に含める
    ].reduce((sum, item) => sum + item.amount, 0);

    const fixedTotal = fixedItems.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("fixedTotal").textContent = fixedTotal.toLocaleString() + " 円";

    const variableTotal = variableItems.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("variableTotal").textContent = variableTotal.toLocaleString() + " 円";

    const totalEl = document.getElementById("totalAmount");
    if (totalEl) {
        totalEl.textContent = `${total.toLocaleString()} 円`;
    }
}

function updateShareText() {
    const shareTextEl = document.getElementById("shareText");
    if (!shareTextEl) return;

    let text = `【${year}年${month}月の家計簿まとめ】\n`;
    text += "-------------------------\n";

    // 変動費
    text += "~~変動費~~\n";
    if (variableItems.length === 0) {
        text += "（なし）\n";
    } else {
        variableItems.forEach(i => {
            text += `${i.name}：${i.amount.toLocaleString()}円\n`;
        });
    }

    // 固定費
    text += "\n~~固定費~~\n";
    if (fixedItems.length === 0) {
        text += "（なし）\n";
    } else {
        fixedItems.forEach(i => {
            text += `${i.name}：${i.amount.toLocaleString()}円\n`;
        });
    }

    // 支出合計
    const total = [
        ...variableItems,
        ...fixedItems
    ].reduce((sum, item) => sum + item.amount, 0);

    text += `\n支出合計：${total.toLocaleString()}円\n`;

    // ★ 貯金（カテゴリごと）
    text += "\n~~貯金~~\n";

    const labels = {
        household: "家計",
        omame: "おまめ",
        ikkun: "いっくん"
    };

    let hasSaving = false;

    for (const type in savingItems) {
        const list = savingItems[type];

        if (list.length > 0) {
            hasSaving = true;
            text += `\n【${labels[type]}用】\n`;
            list.forEach(i => {
                text += `${i.name}：${i.amount.toLocaleString()}円\n`;
            });
        }
    }

    if (!hasSaving) {
        text += "（なし）\n";
    }

    shareTextEl.value = text;
}


function renderVariable() {
    const itemList = document.getElementById("itemList");
    if (!itemList) return;

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
   初期読み込み（固定費・変動費・貯金）
------------------------------ */
async function loadData() {

    const monthSnap = await monthDoc.get();

    // ▼ 収入（incomeItems）
    if (monthSnap.exists && monthSnap.data().incomeItems) {
        incomeItems = monthSnap.data().incomeItems;
    } else {
        // 初期構造
        incomeItems = {
            omame: [],
            ikkun: []
        };
        await monthDoc.set({ incomeItems }, { merge: true });
    }

    // ▼ 変動費
    variableItems = monthSnap.exists && monthSnap.data().variableItems
        ? monthSnap.data().variableItems
        : [];

    // ▼ 固定費
    if (monthSnap.exists && monthSnap.data().fixedItems) {
        fixedItems = monthSnap.data().fixedItems;
    } else {
        const templateSnap = await fixedTemplateDoc.get();
        fixedItems = templateSnap.exists ? templateSnap.data().fixedItems : [];
        await monthDoc.set({ fixedItems }, { merge: true });
    }

    // ▼ 貯金（savingItems）
    if (monthSnap.exists && monthSnap.data().savingItems) {
        savingItems = monthSnap.data().savingItems;
    } else {
        const savingSnap = await savingTemplateDoc.get();
        if (savingSnap.exists && savingSnap.data().savingItems !== undefined) {
            savingItems = savingSnap.data().savingItems;
        } else {
            // ★ 初期構造を作る
            savingItems = {
                household: [],
                omame: [],
                ikkun: []
            };
        }

        await monthDoc.set({ savingItems }, { merge: true });
    }

    initVariablePage();
    initFixedPage();
    initSavingPage();   // ★ 追加

    renderVariable();
}

loadData();


/* ============================================================
   収入入力ページ 初期化
============================================================ */
function initIncomePage() {
    if (window.incomePageInitialized) return;
    window.incomePageInitialized = true;

    console.log("収入ページ 初期化");

    setupIncomeCombo("omameIncomeName", "omameIncomeCombo");
    setupIncomeCombo("ikkunIncomeName", "ikkunIncomeCombo");

    renderIncome();
}

// コンボボックス
function setupIncomeCombo(inputId, listId) {
    const input = document.getElementById(inputId);
    const list = document.getElementById(listId);

    input.addEventListener("focus", () => {
        list.style.display = "block";
    });

    list.addEventListener("mousedown", (e) => {
        if (e.target.classList.contains("option")) {
            input.value = e.target.textContent;
        }
    });

    input.addEventListener("blur", () => {
        setTimeout(() => list.style.display = "none", 100);
    });
}

setupIncomeCombo("omameIncomeName", "omameIncomeCombo");
setupIncomeCombo("ikkunIncomeName", "ikkunIncomeCombo");


// おまめ
document.getElementById("omameIncomeAddBtn").onclick = async () => {
    const name = document.getElementById("omameIncomeName").value.trim();
    const amount = Number(document.getElementById("omameIncomeAmount").value);

    if (!name || !amount) return;

    incomeItems.omame.push({ name, amount });

    await monthDoc.set({ incomeItems }, { merge: true });

    renderIncome();

    document.getElementById("omameIncomeName").value = "";
    document.getElementById("omameIncomeAmount").value = "";
};

// いっくん
document.getElementById("ikkunIncomeAddBtn").onclick = async () => {
    const name = document.getElementById("ikkunIncomeName").value.trim();
    const amount = Number(document.getElementById("ikkunIncomeAmount").value);

    if (!name || !amount) return;

    incomeItems.ikkun.push({ name, amount });

    await monthDoc.set({ incomeItems }, { merge: true });

    renderIncome();

    document.getElementById("ikkunIncomeName").value = "";
    document.getElementById("ikkunIncomeAmount").value = "";
};

// おまめ編集処理
const itemList = document.getElementById("omameIncomeList");
if (itemList) {
    itemList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const index = Number(li.dataset.index);
        const item = incomeItems.omame[index];

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
                await monthDoc.set({ incomeItems }, { merge: true });
                renderIncome();   // ← これが正しい
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
            incomeItems.omame.splice(index, 1);
            await monthDoc.set({ incomeItems }, { merge: true });
            renderIncome();
        }
    };
}

// いっくん編集処理
const ikkunList = document.getElementById("ikkunIncomeList");
if (ikkunList) {
    ikkunList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const index = Number(li.dataset.index);
        const item = incomeItems.ikkun[index];

        // 編集
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

                await monthDoc.set({ incomeItems }, { merge: true });
                renderIncome();   // ← これが正しい
            };

            // Enterキーで保存
            nameInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });
            amountInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });

            // 編集エリア外にフォーカスが移動したら保存
            editArea.addEventListener("focusout", (ev) => {
                if (editArea.contains(ev.relatedTarget)) return;
                saveEdit();
            });

            return;
        }

        // 削除
        if (e.target.classList.contains("deleteBtn")) {
            incomeItems.ikkun.splice(index, 1);

            await monthDoc.set({ incomeItems }, { merge: true });
            renderIncome();   // ← これが正しい
        }
    };
}

// 収入追加リスト
function renderIncome() {
    const omameList = document.getElementById("omameIncomeList");
    const ikkunList = document.getElementById("ikkunIncomeList");

    omameList.innerHTML = "";
    ikkunList.innerHTML = "";

    incomeItems.omame.forEach((item, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span>${item.name}：${item.amount.toLocaleString()} 円</span>
            <span class="actions">
                <button class="editBtn">編集</button>
                <button class="deleteBtn">削除</button>
            </span>
        `;
        li.dataset.category = "omame";
        li.dataset.index = idx;
        omameList.appendChild(li);
    });

    incomeItems.ikkun.forEach((item, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span>${item.name}：${item.amount.toLocaleString()} 円</span>
            <span class="actions">
                <button class="editBtn">編集</button>
                <button class="deleteBtn">削除</button>
            </span>
        `;
        li.dataset.category = "ikkun";
        li.dataset.index = idx;
        ikkunList.appendChild(li);
    });
}



/* ============================================================
   変動費ページ 初期化
============================================================ */
function initVariablePage() {
    if (window.variablePageInitialized) return;
    window.variablePageInitialized = true;

    console.log("変動費ページ 初期化");

    const itemNameInput = document.getElementById("itemName");
    const comboList = document.getElementById("comboList");

    if (itemNameInput && comboList) {
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
    }

    const addBtn = document.getElementById("addBtn");
    if (addBtn) {
        addBtn.onclick = async () => {
            const name = document.getElementById("itemName").value.trim();
            const amount = Number(document.getElementById("itemAmount").value);

            if (!name || !amount) return;

            variableItems.push({ name, amount });
            await monthDoc.set({ variableItems }, { merge: true });
            renderVariable();

            document.getElementById("itemName").value = "";
            document.getElementById("itemAmount").value = "";
        };
    }

    const itemList = document.getElementById("itemList");
    if (itemList) {
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
                    await monthDoc.set({ variableItems }, { merge: true });
                    renderVariable();
                };

                // Enterキーで保存
                nameInput.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") saveEdit();
                });
                amountInput.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") saveEdit();
                });

                // 編集エリア全体からフォーカスが外れたら保存
                editArea.addEventListener("focusout", (ev) => {
                    // 編集エリア内の要素にフォーカスが移動した場合は保存しない
                    if (editArea.contains(ev.relatedTarget)) return;

                    saveEdit();
                });

                return;
            }

            if (e.target.classList.contains("deleteBtn")) {
                variableItems.splice(index, 1);
                await monthDoc.set({ variableItems }, { merge: true });
                renderVariable();
            }
        };
    }

    const copyBtn = document.getElementById("copyBtn");
    const shareText = document.getElementById("shareText");
    if (copyBtn && shareText) {
        copyBtn.addEventListener("click", () => {
            navigator.clipboard.writeText(shareText.value)
                .then(() => {
                    copyBtn.textContent = "コピーしました！";
                    setTimeout(() => {
                        copyBtn.textContent = "コピーする";
                    }, 1500);
                });
        });
    }
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
        if (!fixedList) return;

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

    const fixedAddBtn = document.getElementById("fixedAddBtn");
    if (fixedAddBtn) {
        fixedAddBtn.onclick = async () => {
            const name = document.getElementById("fixedName").value.trim();
            const amount = Number(document.getElementById("fixedAmount").value);

            if (!name || !amount) return;

            fixedItems.push({ name, amount });

            await monthDoc.set({ fixedItems }, { merge: true });
            await fixedTemplateDoc.set({ fixedItems }, { merge: true });

            renderFixed();
            renderVariable();

            document.getElementById("fixedName").value = "";
            document.getElementById("fixedAmount").value = "";
        };
    }

    if (fixedList) {
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

                    await monthDoc.set({ fixedItems }, { merge: true });
                    await fixedTemplateDoc.set({ fixedItems }, { merge: true });

                    renderFixed();
                    renderVariable();
                };

                // Enterキーで保存
                nameInput.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") saveEdit();
                });
                amountInput.addEventListener("keydown", (ev) => {
                    if (ev.key === "Enter") saveEdit();
                });

                // 編集エリア全体からフォーカスが外れたら保存
                editArea.addEventListener("focusout", (ev) => {
                    // 編集エリア内の要素にフォーカスが移動した場合は保存しない
                    if (editArea.contains(ev.relatedTarget)) return;

                    saveEdit();
                });

                return;
            }

            if (e.target.classList.contains("deleteBtn")) {
                fixedItems.splice(index, 1);

                await monthDoc.set({ fixedItems }, { merge: true });
                await fixedTemplateDoc.set({ fixedItems }, { merge: true });

                renderFixed();
                renderVariable();
            }
        };
    }

    renderFixed();
}

/* ============================================================
   貯金ページ 初期化（saving-edit）
============================================================ */
function initSavingPage() {
    if (window.savingPageInitialized) return;
    window.savingPageInitialized = true;

    console.log("貯金ページ 初期化");

    const savingList = document.getElementById("savingList");

    function renderSaving() {
        savingList.innerHTML = "";

        const categories = {
            household: "家計用貯金リスト",
            omame: "おまめ用貯金リスト",
            ikkun: "いっくん用貯金リスト"
        };

        for (const key in categories) {
            const title = document.createElement("h3");
            title.textContent = categories[key];
            savingList.appendChild(title);

            savingItems[key].forEach((item, idx) => {
                const li = document.createElement("li");
                li.classList.add("saving-item");
                li.dataset.category = key;
                li.dataset.index = idx;
                li.innerHTML = `
                <span>${item.name}：${item.amount.toLocaleString()} 円</span>
                <span class="actions">
                    <button class="editBtn">編集</button>
                    <button class="deleteBtn">削除</button>
                </span>
            `;
                savingList.appendChild(li);
            });
        }
    }

    document.getElementById("savingAddBtn").onclick = async () => {
        const name = document.getElementById("savingName").value.trim();
        const amount = Number(document.getElementById("savingAmount").value);

        if (!name || !amount) return;

        const type = document.querySelector("input[name='savingType']:checked").value;

        savingItems[type].push({ name, amount });

        await monthDoc.set({ savingItems }, { merge: true });
        await savingTemplateDoc.set({ savingItems }, { merge: true });

        renderSaving();
        renderVariable();

        document.getElementById("savingName").value = "";
        document.getElementById("savingAmount").value = "";
    };

    savingList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const category = li.dataset.category;
        const index = Number(li.dataset.index);
        const item = savingItems[category][index];

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

                await monthDoc.set({ savingItems }, { merge: true });
                await savingTemplateDoc.set({ savingItems }, { merge: true });

                renderSaving();
                renderVariable();
            };

            // Enterキーで保存
            nameInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });
            amountInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });

            // 編集エリア全体からフォーカスが外れたら保存
            editArea.addEventListener("focusout", (ev) => {
                // 編集エリア内の要素にフォーカスが移動した場合は保存しない
                if (editArea.contains(ev.relatedTarget)) return;

                saveEdit();
            });

            return;
        }

        if (e.target.classList.contains("deleteBtn")) {
            savingItems[category].splice(index, 1);

            await monthDoc.set({ savingItems }, { merge: true });
            await savingTemplateDoc.set({ savingItems }, { merge: true });

            renderSaving();
            renderVariable();
        }
    };
    renderSaving();
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

        if (page === "income-input") {
            initIncomePage();
        }

        if (page === "expense-list") {
            initVariablePage();
            renderVariable();
        }

        if (page === "fixed-edit") {
            initFixedPage();
        }

        if (page === "saving-edit") {
            initSavingPage();
        }
    });
});
