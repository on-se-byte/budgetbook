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
document.getElementById("homeTitle").textContent = `${year}年${month}月 家計簿`;

// ▼ 固定費テンプレート（共通）
const fixedTemplateDoc = db.collection("households").doc("fixedTemplate");

// ▼ 貯金テンプレート（共通）
const savingTemplateDoc = db.collection("households").doc("savingTemplate");

// ▼ 総資産（共通）
const assetsDoc = db.collection("households").doc("assets");

// ▼ 月ごとのデータ
const monthDoc = db.collection("rooms").doc(roomId);

let incomeItems = {
    omame: [],
    ikkun: [],
    household: []
};
let fixedItems = [];
let variableItems = [];
let savingInputItems = {
    household: [],
    omame: [],
    ikkun: []
};
let savingEditItems = {
    household: [],
    omame: [],
    ikkun: []
};
let assetItems = {
    household: [],
    omame: [],
    ikkun: []
};

let usingInputItems = [];


/* ------------------------------
   ホーム
------------------------------ */
function renderHome() {
    // ▼ 収入（おまめ・いっくん）
    const omameIncome = incomeItems.omame.reduce((sum, i) => sum + i.amount, 0);
    const ikkunIncome = incomeItems.ikkun.reduce((sum, i) => sum + i.amount, 0);
    const householdIncome = incomeItems.household.reduce((sum, i) => sum + i.amount, 0);
    const incomeTotal = omameIncome + ikkunIncome + householdIncome;

    // ▼ 収入比（％）
    const workIncomeTotal = omameIncome + ikkunIncome;
    const omameRatio = workIncomeTotal > 0 ? Math.round((omameIncome / workIncomeTotal) * 100) : 0;
    const ikkunRatio = workIncomeTotal > 0 ? Math.round((ikkunIncome / workIncomeTotal) * 100) : 0;

    // ▼ 支出合計
    const expenseTotal = fixedItems.reduce((sum, i) => sum + i.amount, 0) + variableItems.reduce((sum, i) => sum + i.amount, 0);

    // ▼ 貯金（家計＋おまめ＋いっくん）
    const savingTotal = [
        ...savingInputItems.household,
        ...savingInputItems.omame,
        ...savingInputItems.ikkun,
        ...savingEditItems.household,
        ...savingEditItems.omame,
        ...savingEditItems.ikkun
    ].reduce((sum, i) => sum + i.amount, 0);

    // ▼ お小遣い
    const omamePocket = Math.round((incomeTotal - expenseTotal - savingTotal) * omameRatio / 100);
    const ikkunPocket = Math.round((incomeTotal - expenseTotal - savingTotal) * ikkunRatio / 100);


    // ▼ ホーム画面へ反映
    document.getElementById("omamePocket").textContent = omamePocket.toLocaleString() + " 円";
    document.getElementById("ikkunPocket").textContent = ikkunPocket.toLocaleString() + " 円";

    document.getElementById("omameRatio").textContent = `収入比 ${omameRatio}%`;
    document.getElementById("ikkunRatio").textContent = `収入比 ${ikkunRatio}%`;

    document.getElementById("incomeTotalHome").textContent = incomeTotal.toLocaleString() + " 円";
    document.getElementById("expenseTotalHome").textContent = expenseTotal.toLocaleString() + " 円";
    document.getElementById("savingTotalHome").textContent = savingTotal.toLocaleString() + " 円";

    // 月締め
    document.getElementById("closeMonthBtn").onclick = async () => {
        await closeMonth();
    };
}


/* ============================================================
   月締め処理
============================================================ */
async function closeMonth() {

    const monthSnap = await monthDoc.get();
    const monthData = monthSnap.data();

    // ▼ すでに締めているなら何もしない
    if (monthData.closed) {
        showError("この月はすでに月締め済みです。");
        return;
    }

    // ▼ 前月チェック
    const prevRoomId = getPrevRoomId(roomId);
    const prevDoc = db.collection("rooms").doc(prevRoomId);
    const prevSnap = await prevDoc.get();


    if (prevSnap.exists && !prevSnap.data().closed) {
        const ok = await showPopup("前月が月締めされていません。\n月締めしますか？");

        if (ok) {
            await closeSpecificMonth(prevRoomId);
        } else {
            return;
        }
    }

    // ▼ 今月を締める
    await closeSpecificMonth(roomId);

    await showError("月締めが完了しました。");
    location.reload();

}

// 前月取得処理
function getPrevRoomId(currentRoomId) {
    const [yearStr, monthStr] = currentRoomId.split("-");
    let year = Number(yearStr);
    let month = Number(monthStr);

    // ▼ 前月へ
    month -= 1;

    // ▼ 1月 → 前年の12月
    if (month === 0) {
        month = 12;
        year -= 1;
    }

    // ▼ ゼロ埋め（例：3 → "03"）
    const monthPadded = String(month).padStart(2, "0");

    return `${year}-${monthPadded}`;
}


/* ============================================================
   前月月締め処理
============================================================ */
async function closeSpecificMonth(id) {
    const docRef = db.collection("rooms").doc(id);
    const snap = await docRef.get();
    const data = snap.data();

    // ▼ 総資産を読み込む
    const assetsSnap = await assetsDoc.get();
    const finalAssets = assetsSnap.data().accounts.saving;

    // ▼ 月締めフラグ + 総資産スナップショット保存
    await docRef.set({
        closed: true,
        finalAssets: finalAssets
    }, { merge: true });
}


/* ============================================================
   合計 & 共有テキスト & 変動費描画（どこからでも呼べるように外出し）
============================================================ */
function recalcTotal() {
    // 支出
    const expenseTotalMath = [
        ...variableItems,
        ...fixedItems,
    ].reduce((sum, item) => sum + item.amount, 0);

    const fixedTotal = fixedItems.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("fixedTotal").textContent = fixedTotal.toLocaleString() + " 円";

    const variableTotal = variableItems.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("variableTotal").textContent = variableTotal.toLocaleString() + " 円";

    const totalEl = document.getElementById("totalAmount");
    if (totalEl) {
        totalEl.textContent = `${expenseTotalMath.toLocaleString()} 円`;
    }

    // 貯金
    const savingTotalMath = [
        ...savingInputItems.household,
        ...savingInputItems.omame,
        ...savingInputItems.ikkun,
        ...savingEditItems.household,
        ...savingEditItems.omame,
        ...savingEditItems.ikkun
    ].reduce((sum, item) => sum + item.amount, 0);

    const variableSavingTotal = [...savingInputItems.household, ...savingInputItems.omame, ...savingInputItems.ikkun].reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("variableSavingTotal").textContent = variableSavingTotal.toLocaleString() + " 円";

    const fixedSavingTotal = [...savingEditItems.household, ...savingEditItems.omame, ...savingEditItems.ikkun].reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("fixedSavingTotal").textContent = fixedSavingTotal.toLocaleString() + " 円";

    const savingTotal = document.getElementById("SavingTotal");
    savingTotal.textContent = `${savingTotalMath.toLocaleString()} 円`;
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

    for (const type in savingEditItems) {
        const list = savingEditItems[type];

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

// 変動費追加処理
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

    if (window.isMonthClosed) {
        disableAllEditing();
    }
}

/* ------------------------------
   初期読み込み
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
            ikkun: [],
            household: []
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

    // ▼ 貯金使用
    usingInputItems = monthSnap.data().usingInputItems;

    // ▼ 臨時貯金（savingInputItems）
    savingInputItems = monthSnap.exists && monthSnap.data().savingInputItems
        ? monthSnap.data().savingInputItems
        : savingInputItems = {
            household: [],
            omame: [],
            ikkun: []
        };;


    // ▼ 固定貯金（savingEditItems）
    // TODO
    await assetLoad();
    if (monthSnap.exists && monthSnap.data().savingEditItems) {
        savingEditItems = monthSnap.data().savingEditItems;
    } else {
        const savingSnap = await savingTemplateDoc.get();
        if (savingSnap.exists && savingSnap.data().savingEditItems !== undefined) {
            savingEditItems = savingSnap.data().savingEditItems;
        } else {
            savingEditItems = {
                household: [],
                omame: [],
                ikkun: []
            };
        }

        // rooms にテンプレコピー
        await monthDoc.set({ savingEditItems }, { merge: true });

        /* ▼▼▼ 積立処理（新しい月の初回だけ） ▼▼▼ */
        for (const category in savingEditItems) {
            savingEditItems[category].forEach(item => {

                const savingList = assetItems[category] || [];

                // ★ name + account の両方で一致するものを探す
                const idx = savingList.findIndex(i =>
                    i.name === item.name && i.account === item.account
                );

                if (idx >= 0) {
                    // 既存 → 金額だけ積み増し
                    savingList[idx].amount += item.amount;
                } else {
                    // 新規 → account を含めて追加
                    savingList.push({
                        name: item.name,
                        amount: item.amount,
                        account: item.account || "cash" // 既存データ対策
                    });
                }

                assetItems[category] = savingList;
            });
        }

        await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });
        /* ▲▲▲ 積立処理ここまで ▲▲▲ */
    }

    // ▼ 総資産
    if (monthSnap.data().closed) {
        // 月締め後 → finalAssets を使う
        assetItems = monthSnap.data().finalAssets;
    } else {
        // 月締め前 → households の総資産を使う
        await assetLoad();
    }

    initVariablePage();
    initFixedPage();
    initSavingEditPage();
    renderHome();
    renderVariable();

    // 月締め後は編集不可
    if (monthSnap.data().closed) {
        window.isMonthClosed = true;
        // finalAssets を使う
        assetItems = monthSnap.data().finalAssets;

        disableAllEditing();
        return;
    } else {
        window.isMonthClosed = false;
    }

}

/* ============================================================
   編集不可処理
============================================================ */
function disableAllEditing() {

    const disableBtn = (btn) => {
        btn.disabled = true;
        btn.style.opacity = "0.6";
        btn.style.cursor = "not-allowed";
        btn.style.background = "#ccc";
    };

    // 編集ボタン（非表示）
    document.querySelectorAll(".editBtn").forEach(btn => {
        btn.style.display = "none";
    });

    // 削除ボタン（非表示）
    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.style.display = "none";
    });

    // 振替ボタン（非表示）
    document.querySelectorAll(".changeBtn").forEach(btn => {
        btn.style.display = "none";
    });

    // 追加ボタン + 月締めボタン
    document.querySelectorAll(".addBtn").forEach(btn => {
        disableBtn(btn);
    });
}

// 削除
// function loadClosedMonthView(data) {
//     assetItems = data.finalAssets;

//     // 編集不可のため、render だけ行う
//     renderHome();
//     renderVariable();
// }

loadData();

/* ============================================================
   総資産読み込み
============================================================ */
async function assetLoad() {
    const assetsSnap = await assetsDoc.get();
    assetItems = assetsSnap.data().accounts.saving
        ? assetsSnap.data().accounts.saving
        : assetItems;
}

/* ============================================================
   収入入力ページ 初期化
============================================================ */
function initIncomePage() {

    console.log("収入ページ 初期化");

    setupIncomeCombo("incomeName", "incomeCombo");

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

setupIncomeCombo("incomeName", "incomeCombo");


// 追加ボタン押下時
document.getElementById("incomeAddBtn").onclick = async () => {
    const name = document.getElementById("incomeName").value.trim();
    const amount = Number(document.getElementById("incomeAmount").value);

    if (!name || !amount) return;

    // ▼ どちらに追加するか（ラジオボタン）
    const type = document.querySelector('input[name="incomeInputType"]:checked').value;

    // ▼ いっくん or おまめ の配列に追加
    incomeItems[type].push({ name, amount });

    // ▼ Firestore 保存
    await monthDoc.set({ incomeItems }, { merge: true });

    // ▼ 再描画
    renderIncome();

    // ▼ 入力欄クリア
    document.getElementById("incomeName").value = "給料"; // 初期値に戻す
    document.getElementById("incomeAmount").value = "";
};

// 編集処理呼び出し
setupIncomeEdit("omameIncomeList", "omame");
setupIncomeEdit("ikkunIncomeList", "ikkun");
setupIncomeEdit("householdIncomeList", "household");


// 編集削除処理
function setupIncomeEdit(listId, key) {
    const list = document.getElementById(listId);
    if (!list) return;

    list.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const index = Number(li.dataset.index);
        const item = incomeItems[key][index];

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
                renderIncome();
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

        // 削除
        if (e.target.classList.contains("deleteBtn")) {
            incomeItems[key].splice(index, 1);

            await monthDoc.set({ incomeItems }, { merge: true });
            renderIncome();
        }
    };
}

// 非表示処理
function toggleIncomeSection(listId) {
    const ul = document.getElementById(listId);
    const section = ul.closest(".part-list-area");
    const h3 = section.previousElementSibling; // ← 直前の h3

    if (ul.children.length === 0) {
        section.style.display = "none";
        h3.style.display = "none";
    } else {
        section.style.display = "";
        h3.style.display = "";
    }
}

// リスト作成処理
function renderIncome() {
    const omameList = document.getElementById("omameIncomeList");
    const ikkunList = document.getElementById("ikkunIncomeList");
    const householdList = document.getElementById("householdIncomeList");

    // まず中身をクリア
    omameList.innerHTML = "";
    ikkunList.innerHTML = "";
    householdList.innerHTML = "";

    // ▼ おまめ
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

    // ▼ いっくん
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

    // ▼ 家計
    incomeItems.household?.forEach((item, idx) => {
        const li = document.createElement("li");
        li.innerHTML = `
            <span>${item.name}：${item.amount.toLocaleString()} 円</span>
            <span class="actions">
                <button class="editBtn">編集</button>
                <button class="deleteBtn">削除</button>
            </span>
        `;
        li.dataset.category = "household";
        li.dataset.index = idx;
        householdList.appendChild(li);
    });

    // ▼ ★ ここが重要：空なら h3 + div を非表示にする
    toggleIncomeSection("ikkunIncomeList");
    toggleIncomeSection("omameIncomeList");
    toggleIncomeSection("householdIncomeList");

    // ▼ 合計計算
    const omameTotal = incomeItems.omame.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("omameTotal").textContent = omameTotal.toLocaleString() + " 円";

    const ikkunTotal = incomeItems.ikkun.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("ikkunTotal").textContent = ikkunTotal.toLocaleString() + " 円";

    const householdTotal = incomeItems.household.reduce((sum, i) => sum + i.amount, 0);
    document.getElementById("householdTotal").textContent = householdTotal.toLocaleString() + " 円";

    const incomeTotal = omameTotal + ikkunTotal + householdTotal;
    document.getElementById("incomeTotal").textContent = incomeTotal.toLocaleString() + " 円";

    if (window.isMonthClosed) {
        disableAllEditing();
    }
}



/* ============================================================
   変動費ページ 初期化
============================================================ */
function initVariablePage() {
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

    const variableAddBtn = document.getElementById("variableAddBtn");
    if (variableAddBtn) {
        variableAddBtn.onclick = async () => {
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

// 支出プルダウン
// function renderExpenseFromOptions() {
//     const select = document.getElementById("expenseFrom");
//     select.innerHTML = `<option value="normal">通常の支出</option>`;

//     if (!assetItems) return;

//     Object.keys(assetItems).forEach(key => {

//         const option = document.createElement("option");
//         option.textContent = `${key}`;
//         select.appendChild(option);
//     });
// }

async function addVariableExpense() {
    const name = itemName.value;
    const amount = Number(itemAmount.value);
    const from = document.getElementById("expenseFrom").value;

    // ▼ 月の変動費に追加
    variableItems.push({ name, amount, from });
    await monthDoc.set({ variableItems }, { merge: true });

    // ▼ 貯蓄カテゴリから出す場合
    if (from.startsWith("saving:")) {
        const category = from.split(":")[1];

        // ▼ assetItems を直接更新
        assetItems[category] = assetItems[category] || [];
        assetItems[category].push({ name, amount: -amount });

        // ▼ Firestore 保存
        await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });
    }

    renderVariable();
}


/* ============================================================
   固定費編集ページ 初期化
============================================================ */
function initFixedPage() {
    if (window.fixedPageInitialized) return;
    window.fixedPageInitialized = true;

    console.log("固定費編集ページ 初期化");

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

            fixedItems.unshift({ name, amount });

            await monthDoc.set({ fixedItems }, { merge: true });
            await fixedTemplateDoc.set({ fixedItems }, { merge: true });

            renderFixed();

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
   貯金使用ページ
============================================================ */
// ===============================
// 初期処理
// ===============================
function initUsingPage() {
    // ▼ 1. カテゴリの最初の項目を選択
    const categorySelect = document.getElementById("useCategory");
    categorySelect.selectedIndex = 0;

    // ▼ 2. 最初のカテゴリで項目プルダウンを更新
    updateItemSelect(categorySelect.value);

    // ▼ 3. 使用リストを表示
    renderUsingList();
}

// ===============================
// ラベル
// ===============================
const accountLabels = {
    cash: "現金",
    ikkunBank: "いっくん口座",
    omameBank: "おまめ口座",
    ikkunNisa: "いっくんNISA",
    omameNisa: "おまめNISA"
};
const categoryLabels = {
    household: "家計",
    ikkun: "いっくん",
    omame: "おまめ"
};

const categories = {
    household: "家計用貯金リスト",
    ikkun: "いっくん用貯金リスト",
    omame: "おまめ用貯金リスト"
};

// ===============================
// カテゴリ変更 → 項目プルダウン更新
// ===============================
document.getElementById("useCategory").addEventListener("change", () => {
    const category = document.getElementById("useCategory").value;
    updateItemSelect(category);
});

// ===============================
// 項目プルダウン更新
// ===============================
function updateItemSelect(category) {
    const select = document.getElementById("useItem");
    select.innerHTML = "";

    // assetItems[category] の中の項目を全部表示
    assetItems[category].forEach(item => {
        const opt = document.createElement("option");
        opt.value = JSON.stringify(item); // 後で使うため item を丸ごと入れる
        opt.textContent = `${item.name}（${accountLabels[item.account]} ${item.amount.toLocaleString()}円）`;
        select.appendChild(opt);
    });
}

// ===============================
// 使用登録
// ===============================
document.getElementById("useAddBtn").onclick = async () => {
    const user = document.querySelector("input[name='useUser']:checked").value; // いっくん or おまめ
    const category = document.getElementById("useCategory").value;

    const item = JSON.parse(document.getElementById("useItem").value);
    const amount = Number(document.getElementById("useAmount").value);

    if (!amount || amount <= 0) {
        showError("金額を入力してください");
        return;
    }

    // ===============================
    // 残高チェック
    // ===============================
    const list = assetItems[category];
    const idx = list.findIndex(i => i.name === item.name && i.account === item.account);

    if (idx < 0) {
        showError("該当の貯金項目が見つかりません");
        return;
    }

    if (list[idx].amount < amount) {
        showError("残高より大きい金額は使用できません");
        return; // ← ここで絶対に終了
    }

    // ===============================
    // ここから先は「使用できる場合だけ」
    // ===============================
    usingInputItems.push({
        user,                       // 使用者
        category,                   // 家計/いっくん/おまめ
        account: item.account,      // 現金/口座/NISA
        name: item.name,            // 医療費など
        amount,
        date: Date.now()
    });

    // ===============================
    // assetItems から差し引き
    // ===============================
    list[idx].amount -= amount;
    if (list[idx].amount <= 0) list.splice(idx, 1);

    await Promise.all([
        monthDoc.set({ usingInputItems }, { merge: true }),
        assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true })
    ]);

    renderUsingList();
    renderAssetList();
    updateItemSelect(category);

    document.getElementById("useAmount").value = "";
};

// ===============================
// 使用リスト表示
// ===============================
function renderUsingList() {
    const list = document.getElementById("usingList");
    list.innerHTML = "";

    // ▼ 使用者ごとにグループ化（元の index を保持）
    const groups = {
        "いっくん": [],
        "おまめ": []
    };

    usingInputItems.forEach((item, originalIndex) => {
        groups[item.user].push({
            ...item,
            originalIndex   // ← ★ これが重要
        });
    });

    // ▼ いっくん → おまめ の順で表示
    ["いっくん", "おまめ"].forEach(user => {
        const items = groups[user];
        if (items.length === 0) return;

        // ▼ 見出し
        const title = document.createElement("h3");
        title.className = "h3";
        title.textContent = `${user}`;
        list.appendChild(title);

        // ▼ リスト本体
        items.forEach(u => {
            const li = document.createElement("li");

            const date = new Date(u.date);
            const dateStr = `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;

            li.className = "using-item";

            li.innerHTML = `
                <div class="using-line1">
                    ${categoryLabels[u.category]}用貯金 - ${accountLabels[u.account]}　<${dateStr}>
                </div>
                <div class="using-line2">
                    <span class="using-maintext">${u.name}：${u.amount.toLocaleString()}円</span>
                    <button class="deleteBtn" data-index="${u.originalIndex}">削除</button>
                </div>
            `;

            list.appendChild(li);
        });
        if (window.isMonthClosed) {
            disableAllEditing();
        }
    });

    // ===============================
    // 削除処理（originalIndex を使う）
    // ===============================
    document.querySelectorAll(".deleteBtn").forEach(btn => {
        btn.addEventListener("click", async () => {
            const idx = Number(btn.dataset.index); // ← ★ これが元の index
            const u = usingInputItems[idx];

            // ▼ 総資産に金額を戻す
            const list = assetItems[u.category];
            const assetIdx = list.findIndex(i => i.name === u.name && i.account === u.account);

            if (assetIdx >= 0) {
                list[assetIdx].amount += u.amount;
            } else {
                list.push({
                    name: u.name,
                    account: u.account,
                    amount: u.amount
                });
            }

            // ▼ usingInputItems から削除
            usingInputItems.splice(idx, 1);

            // ▼ Firestore 保存
            await Promise.all([
                monthDoc.set({ usingInputItems }, { merge: true }),
                assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true })
            ]);

            initUsingPage();
            renderAssetList();
        });
    });
}



/* ============================================================
   臨時貯金入力ページ 初期化（saving-input）
============================================================ */
function initSavingInputPage() {
    console.log("臨時貯金入力ページ 初期化");

    const savingInputList = document.getElementById("savingInputList");

    function renderSaving() {
        savingInputList.innerHTML = "";

        for (const catKey in categories) {
            const title = document.createElement("h3");
            title.textContent = categories[catKey];
            savingInputList.appendChild(title);

            // ▼ 口座ごとにグループ化
            const grouped = {};
            savingInputItems[catKey].forEach((item, originalIndex) => {
                const acc = item.account || "cash";
                if (!grouped[acc]) grouped[acc] = [];
                grouped[acc].push({ item, originalIndex });
            });

            // ▼ 口座ごとに表示
            for (const accKey in grouped) {
                const accTitle = document.createElement("h4");
                accTitle.textContent = "　・" + accountLabels[accKey];
                savingInputList.appendChild(accTitle);

                grouped[accKey].forEach(({ item, originalIndex }) => {
                    const li = document.createElement("li");

                    // ★ 元の index と category を保持（これが重要）
                    li.dataset.index = originalIndex;
                    li.dataset.category = catKey;

                    li.innerHTML = `
                        <span>${item.name}：${item.amount.toLocaleString()} 円</span>
                        <span class="actions">
                            <button class="editBtn">編集</button>
                            <button class="deleteBtn">削除</button>
                        </span>
                    `;

                    savingInputList.appendChild(li);
                });
            }
        }

        if (window.isMonthClosed) {
            disableAllEditing();
        }
    }

    /* ---------- 追加 ---------- */
    document.getElementById("savingInputAddBtn").onclick = async () => {
        const name = document.getElementById("savingInputName").value.trim();
        const amount = Number(document.getElementById("savingInputAmount").value);

        if (!name || !amount) return;

        const category = document.querySelector('input[name="savingInputType"]:checked').value;
        const account = document.querySelector('input[name="savingInputAccount"]:checked').value;

        // room 側に追加
        savingInputItems[category].push({ name, amount, account });

        // 総資産側に加算
        const savingList = assetItems[category];
        const idx = savingList.findIndex(i => i.name === name && i.account === account);

        if (idx >= 0) {
            savingList[idx].amount += amount;
        } else {
            savingList.push({ name, amount, account });
        }

        await Promise.all([
            monthDoc.set({ savingInputItems }, { merge: true }),
            assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true })
        ]);

        renderSaving();
        renderVariable();

        document.getElementById("savingInputName").value = "";
        document.getElementById("savingInputAmount").value = "";
    };

    /* ---------- 編集・削除 ---------- */
    savingInputList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const category = li.dataset.category;
        const index = Number(li.dataset.index);
        const item = savingInputItems[category][index];

        /* ---------- 編集 ---------- */
        if (e.target.classList.contains("editBtn")) {

            const oldAmount = item.amount;

            const span = li.querySelector("span");
            const actions = li.querySelector(".actions");

            const input = document.createElement("input");
            input.type = "number";
            input.classList.add("editAmount");
            input.value = item.amount;

            span.style.display = "none";
            actions.style.display = "none";
            li.appendChild(input);

            input.focus();
            input.select();

            const savingList = assetItems[category];
            const assetIdx = savingList.findIndex(i => i.name === item.name);

            let committed = false;

            const saveEdit = async () => {
                if (committed) return;
                committed = true;

                const newAmount = Number(input.value);

                item.amount = newAmount;

                savingList[assetIdx].amount += (newAmount - oldAmount);

                await monthDoc.set({ savingInputItems }, { merge: true });
                await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });

                input.remove();
                span.style.display = "";
                actions.style.display = "";

                renderSaving();
                renderVariable();
            };

            input.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    saveEdit();
                }
            });

            input.addEventListener("blur", saveEdit);

            return;
        }

        /* ---------- 削除 ---------- */
        if (e.target.classList.contains("deleteBtn")) {

            const deleteAmount = item.amount;

            const savingList = assetItems[category];
            const assetIdx = savingList.findIndex(i => i.name === item.name);

            if (assetIdx >= 0 && savingList[assetIdx].amount < deleteAmount) {
                showError("貯金金額より大きい金額のため\n削除できません。");
                return;
            }

            savingInputItems[category].splice(index, 1);

            if (assetIdx >= 0) {
                savingList[assetIdx].amount -= deleteAmount;

                if (savingList[assetIdx].amount <= 0) {
                    savingList.splice(assetIdx, 1);
                }
            }

            await monthDoc.set({ savingInputItems }, { merge: true });
            await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });

            renderSaving();
            renderVariable();
        }
    };

    renderSaving();
}

/* ============================================================
   固定貯金編集ページ 初期化（saving-edit）
============================================================ */
function initSavingEditPage() {
    console.log("貯金ページ 初期化");

    const savingEditList = document.getElementById("savingEditList");

    function renderSaving() {
        savingEditList.innerHTML = "";

        for (const catKey in categories) {
            const title = document.createElement("h3");
            title.textContent = categories[catKey];
            savingEditList.appendChild(title);

            // ▼ 口座ごとにグループ化（元 index を保持）
            const grouped = {};
            savingEditItems[catKey].forEach((item, originalIndex) => {
                const acc = item.account || "cash";
                if (!grouped[acc]) grouped[acc] = [];
                grouped[acc].push({ item, originalIndex });
            });

            // ▼ 口座ごとに表示
            for (const accKey in grouped) {
                const accTitle = document.createElement("h4");
                accTitle.textContent = "　・" + accountLabels[accKey];
                savingEditList.appendChild(accTitle);

                grouped[accKey].forEach(({ item, originalIndex }) => {
                    const li = document.createElement("li");
                    li.classList.add("saving-edit-item");

                    // ★ 元 index とカテゴリを保持
                    li.dataset.index = originalIndex;
                    li.dataset.category = catKey;

                    li.innerHTML = `
                        <span>${item.name}：${item.amount.toLocaleString()} 円</span>
                        <span class="actions">
                            <button class="editBtn">編集</button>
                            <button class="deleteBtn">削除</button>
                        </span>
                    `;

                    savingEditList.appendChild(li);
                });
            }
        }

        if (window.isMonthClosed) {
            disableAllEditing();
        }
    }

    /* ---------- 追加 ---------- */
    document.getElementById("savingEditAddBtn").onclick = async () => {
        const name = document.getElementById("savingEditName").value.trim();
        const amount = Number(document.getElementById("savingEditAmount").value);

        if (!name || !amount) return;

        const category = document.querySelector("input[name='savingEditType']:checked").value;
        const account = document.querySelector("input[name='savingEditAccount']:checked").value;

        // room 側に追加
        savingEditItems[category].unshift({ name, amount, account });

        // 総資産側に加算
        const savingList = assetItems[category];
        const idx = savingList.findIndex(i => i.name === name && i.account === account);

        if (idx >= 0) {
            savingList[idx].amount += amount;
        } else {
            savingList.unshift({ name, amount, account });
        }

        await Promise.all([
            monthDoc.set({ savingEditItems }, { merge: true }),
            savingTemplateDoc.set({ savingEditItems }, { merge: true }),
            assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true })
        ]);

        renderSaving();
        renderVariable();

        document.getElementById("savingEditName").value = "";
        document.getElementById("savingEditAmount").value = "";
    };

    /* ---------- 編集・削除 ---------- */
    savingEditList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const category = li.dataset.category;
        const index = Number(li.dataset.index);
        const item = savingEditItems[category][index];

        /* ---------- 編集 ---------- */
        if (e.target.classList.contains("editBtn")) {

            const oldAmount = item.amount;

            const span = li.querySelector("span");
            const actions = li.querySelector(".actions");

            const input = document.createElement("input");
            input.type = "number";
            input.classList.add("editAmount");
            input.value = item.amount;

            span.style.display = "none";
            actions.style.display = "none";
            li.appendChild(input);

            input.focus();
            input.select();

            const savingList = assetItems[category];
            const assetIdx = savingList.findIndex(i => i.name === item.name);

            let committed = false;

            const saveEdit = async () => {
                if (committed) return;
                committed = true;

                const newAmount = Number(input.value);

                item.amount = newAmount;

                savingList[assetIdx].amount += (newAmount - oldAmount);

                await monthDoc.set({ savingEditItems }, { merge: true });
                await savingTemplateDoc.set({ savingEditItems }, { merge: true });
                await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });

                input.remove();
                span.style.display = "";
                actions.style.display = "";

                renderSaving();
                renderVariable();
            };

            input.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    saveEdit();
                }
            });

            input.addEventListener("blur", saveEdit);

            return;
        }

        /* ---------- 削除 ---------- */
        if (e.target.classList.contains("deleteBtn")) {

            const deleteAmount = item.amount;

            const savingList = assetItems[category];
            const assetIdx = savingList.findIndex(i => i.name === item.name);

            if (assetIdx >= 0 && savingList[assetIdx].amount < deleteAmount) {
                showError("貯金金額より大きい金額のため\n削除できません。");
                return;
            }

            savingEditItems[category].splice(index, 1);

            if (assetIdx >= 0) {
                savingList[assetIdx].amount -= deleteAmount;

                if (savingList[assetIdx].amount <= 0) {
                    savingList.splice(assetIdx, 1);
                }
            }

            await monthDoc.set({ savingEditItems }, { merge: true });
            await savingTemplateDoc.set({ savingEditItems }, { merge: true });
            await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });

            renderSaving();
            renderVariable();
        }
    };

    renderSaving();
}

/* ============================================================
   総資産確認ページ 初期化
============================================================ */
function renderAssetList() {
    console.log("総資産確認ページ 初期化");

    const assetList = document.getElementById("assetList");
    assetList.innerHTML = "";

    // ▼ カテゴリごとに表示
    for (const catKey in categories) {
        const title = document.createElement("h3");
        title.textContent = categories[catKey];
        assetList.appendChild(title);

        // ▼ 口座ごとにグループ化（元 index を保持）
        const grouped = {};
        assetItems[catKey].forEach((item, originalIndex) => {
            const acc = item.account || "cash";
            if (!grouped[acc]) grouped[acc] = [];
            grouped[acc].push({ item, originalIndex });
        });

        // ▼ 口座ごとに表示
        for (const accKey in grouped) {
            const accTitle = document.createElement("h4");
            accTitle.textContent = "　・" + accountLabels[accKey];
            assetList.appendChild(accTitle);

            // ★★★ ここで名前順にソート ★★★
            grouped[accKey].sort((a, b) =>
                a.item.name.localeCompare(b.item.name, "ja")
            );

            grouped[accKey].forEach(({ item, originalIndex }) => {
                const li = document.createElement("li");
                li.classList.add("asset-select-item");

                // ★ 元 index とカテゴリを保持
                li.dataset.index = originalIndex;
                li.dataset.category = catKey;

                let html = `${item.name}：${item.amount.toLocaleString()} 円`;
                if (item.memo) {
                    html += ` <span class="memo-line">　※${item.memo}</span>`;
                }
                li.innerHTML = `
                    <span class="asset-info">${html}</span>
                    <span class="actions">
                        <button class="changeBtn">振替</button>
                        <button class="editBtn">編集</button>
                    </span>
                `;
                // 消す<button class="deleteBtn">削除</button>

                assetList.appendChild(li);
                const changeBtn = li.querySelector(".changeBtn");
                changeBtn.dataset.key = `${catKey}_${item.account}_${item.name}`;
            });
        }
    }

    attachTransferEvents();
    if (window.isMonthClosed) {
        disableAllEditing();
    }

    /* ============================================================
       編集・削除イベント
    ============================================================ */
    assetList.onclick = async (e) => {
        const li = e.target.closest("li");
        if (!li) return;

        const category = li.dataset.category;
        const index = Number(li.dataset.index);
        const item = assetItems[category][index];

        /* ---------- 編集 ---------- */
        if (e.target.classList.contains("editBtn")) {

            li.classList.add("editing");
            li.innerHTML = `
                <div class="edit-wrap">
                    <input type="number" class="editAmount" value="${item.amount}">
                    <input type="text" class="editMemo" placeholder="メモ（任意）" value="${item.memo || ""}">
                </div>
            `;
            const amountInput = li.querySelector(".editAmount");
            const memoInput = li.querySelector(".editMemo");

            amountInput.focus();
            amountInput.select();

            const saveEdit = async () => {
                const newAmount = Number(amountInput.value);
                const newMemo = memoInput.value;

                assetItems[category][index].amount = newAmount;
                assetItems[category][index].memo = newMemo;

                await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });
                renderAssetList();
            };

            // Enter で保存（どちらの input でも OK）
            amountInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });
            memoInput.addEventListener("keydown", (ev) => {
                if (ev.key === "Enter") saveEdit();
            });

            // どちらの input からフォーカスが外れても保存
            amountInput.addEventListener("blur", (ev) => {
                if (!li.contains(ev.relatedTarget)) saveEdit();
            });
            memoInput.addEventListener("blur", (ev) => {
                if (!li.contains(ev.relatedTarget)) saveEdit();
            });

            return;
        }

        /* ---------- 削除 ---------- */
        // if (e.target.classList.contains("deleteBtn")) {

        //     assetItems[category].splice(index, 1);

        //     await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });
        //     renderAssetList();
        // }
    };

    /* ---------- 振替 ---------- */
    // ▼ 振替モーダル
    const transferPopup = document.getElementById("transferPopup");
    const transferFrom = document.getElementById("transferFrom");
    const transferItem = document.getElementById("transferItem");
    const transferAmount = document.getElementById("transferAmount");
    const transferCancel = document.getElementById("transferCancel");
    const transferOk = document.getElementById("transferOk");
    const transferItemInput = document.getElementById("transferItemInput");
    const transferItemList = document.getElementById("transferItemList");
    let userSelectedItem = false;
    let fromLabel = null;

    if (transferItemInput && transferItemList) {
        // フォーカスで開く
        transferItemInput.addEventListener("focus", () => {
            transferItemList.style.display = "block";
        });

        // リスト内クリックで選択（mousedown が重要）
        transferItemList.addEventListener("mousedown", (e) => {
            if (e.target.classList.contains("option")) {
                transferItemInput.value = e.target.textContent;
                transferItemInput.dataset.value = e.target.dataset.value;
                userSelectedItem = true;
            }
        });

        // フォーカス外れたら閉じる（100ms 遅延で option クリックを邪魔しない）
        transferItemInput.addEventListener("blur", () => {
            setTimeout(() => transferItemList.style.display = "none", 100);
            userSelectedItem = false;
        });
    }

    // ▼ 総資産リストの振替ボタンにイベント付与
    let currentFromKey = null;
    function attachTransferEvents() {
        document.querySelectorAll(".changeBtn").forEach((btn) => {
            btn.addEventListener("click", () => {
                currentFromKey = btn.dataset.key;   // ← ここで記録
                openTransferPopup();
            });
        });
    }


    // ▼ モーダルを開く
    function openTransferPopup() {
        const accountList = buildAccountList();

        transferFrom.innerHTML = "";
        accountList.forEach(acc => {
            const opt = document.createElement("option");
            opt.value = acc.key; // category_account
            opt.textContent = acc.label;
            transferFrom.appendChild(opt);
        });

        // ★★★ 選択した行の口座をプルダウン①に反映する ★★★
        if (currentFromKey) {
            const [cat, acc, name] = currentFromKey.split("_");
            const initialKey = `${cat}_${acc}`;   // ← これがプルダウン①の value と一致する
            transferFrom.value = initialKey;
            fromLabel = `${categoryLabels[cat]} - ${accountLabels[acc]} - ${name}`;
        }

        document.getElementById("transferFromDisplay").textContent = `振替元：\n 　${fromLabel}`;

        // ▼ 振替先の表示（入力欄）
        document.getElementById("transferToDisplay").textContent = `振替先：`;

        // 2番目プルダウン更新
        updateItemList();

        // ★★★ change イベントを付け直す（これが本命）★★★
        transferFrom.removeEventListener("change", updateItemList);
        transferFrom.addEventListener("change", () => {
            userSelectedItem = false; // ← ★初期化モードに戻す
            updateItemList();
        });

        transferAmount.value = "";
        transferPopup.style.display = "flex";
    }

    // ▼ キャンセル
    transferCancel.addEventListener("click", () => {
        transferPopup.style.display = "none";
    });

    // ▼ 振替実行
    transferOk.onclick = async () => {
        if (!currentFromKey) return showError("振替元の項目が取得できません");


        const toKey = transferItemInput.dataset.value;
        const toInputName = transferItemInput.value;

        let toCategory, toAccount, toName;

        // ▼ 自由入力
        if (toInputName) {
            const [cat, acc] = transferFrom.value.split("_");
            toCategory = cat;
            toAccount = acc;
            toName = toInputName;
        }
        // ▼ リスト選択
        else {
            [toCategory, toAccount, toName] = toKey.split("_");
        }

        let toIndex = assetItems[toCategory].findIndex(
            i => i.account === toAccount && i.name === toName
        );

        // ▼ index を逆引き
        const [fromCategory, fromAccount, fromName] = currentFromKey.split("_");
        const fromIndex = assetItems[fromCategory].findIndex(
            i => i.account === fromAccount && i.name === fromName
        );
        const fromItem = assetItems[fromCategory][fromIndex];

        const amount = Number(transferAmount.value);
        if (!amount || amount <= 0) {
            showError("金額を入力してください");
            return;
        }
        if (fromItem.amount < amount) return showError("残高が足りません。");

        // ▼ 振替先が存在しない → 新規作成
        if (toIndex === -1) {
            assetItems[toCategory].push({
                account: toAccount,
                name: toName,
                amount: 0
            });
            toIndex = assetItems[toCategory].length - 1;
        }

        const toItem = assetItems[toCategory][toIndex];

        // ▼ 振替
        fromItem.amount -= amount;
        toItem.amount += amount;

        // ▼ 0 円なら削除
        if (fromItem.amount === 0) {
            assetItems[fromCategory].splice(fromIndex, 1);
        }

        await assetsDoc.set({ accounts: { saving: assetItems } }, { merge: true });

        renderAssetList();
        attachTransferEvents();
        transferPopup.style.display = "none";
        currentFromKey = null;
    };

    // 振替プルダウン①
    function buildAccountList() {
        const list = [];

        Object.entries(categoryLabels).forEach(([catKey, catLabel]) => {
            Object.entries(accountLabels).forEach(([accKey, accLabel]) => {
                const key = `${catKey}_${accKey}`;
                const label = `${catLabel}用貯金 - ${accLabel}`;
                list.push({ key, label, catKey, accKey });
            });
        });

        return list;
    }

    // 振替プルダウン②
    function updateItemList() {
        const selectedKey = transferFrom.value;
        const [categoryKey, accountKey] = selectedKey.split("_");

        transferItemList.innerHTML = "";

        const items = assetItems[categoryKey] || [];
        const filtered = items.filter(item => item.account === accountKey);

        filtered.forEach((item) => {
            const div = document.createElement("div");
            div.className = "option";
            div.textContent = item.name;
            div.dataset.value = `${categoryKey}_${item.account}_${item.name}`;
            transferItemList.appendChild(div);
        });

        // ★★★ 初期化は「ユーザーがまだ選んでいない時だけ」 ★★★
        if (!userSelectedItem) {
            const first = transferItemList.querySelector(".option");
            if (first) {
                transferItemInput.value = first.textContent;
                transferItemInput.dataset.value = first.dataset.value;
            } else {
                transferItemInput.value = "";
                transferItemInput.dataset.value = "";
            }
        }
    }

}

















/* ============================================================
   ページ切り替え
============================================================ */
document.querySelectorAll(".sidebar li[data-page]").forEach(item => {
    item.addEventListener("click", async () => {
        const page = item.dataset.page;

        /* ▼ サイドバーの選択状態を更新 */
        document.querySelectorAll(".sidebar li").forEach(li => li.classList.remove("active"));
        item.classList.add("active");

        /* ▼ ページ切り替え */
        document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
        const targetPage = document.getElementById(`page-${page}`);
        targetPage.classList.add("active");

        sidebar.classList.add("closed");

        /* ▼ ページごとの初期化 */
        if (page === "home") {
            renderHome();
        }

        if (page === "income-input") {
            initIncomePage();
        }

        if (page === "expense-list") {
            initVariablePage();
            // renderExpenseFromOptions();
            renderVariable();
        }

        if (page === "fixed-edit") {
            initFixedPage();
        }

        if (page === "useing-fund") {
            initUsingPage();
        }

        if (page === "saving-input") {
            initSavingInputPage();
        }

        if (page === "saving-edit") {
            initSavingEditPage();
        }

        if (page === "asset-select") {
            renderAssetList();
        }
    });
});


/* ============================================================
   エラー
============================================================ */
function showError(msg) {
    return new Promise((resolve) => {
        const popup = document.getElementById("errorPopup");
        const message = document.getElementById("errorPopupMessage");
        const okBtn = document.getElementById("errorPopupOk");

        message.textContent = msg;
        popup.style.display = "flex";

        okBtn.onclick = () => {
            popup.style.display = "none";
            resolve()
        };
    });
}


/* ============================================================
   確認
============================================================ */
function showPopup(message) {
    return new Promise((resolve) => {
        document.getElementById("popupMessage").textContent = message;
        const popup = document.getElementById("popup");
        popup.style.display = "flex";

        document.getElementById("popupYes").onclick = () => {
            popup.style.display = "none";
            resolve(true);
        };

        document.getElementById("popupNo").onclick = () => {
            popup.style.display = "none";
            resolve(false);
        };
    });
}