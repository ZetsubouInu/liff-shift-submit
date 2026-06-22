// 【重要】ここにLINE Developersで取得したLIFF IDを入力してください
const LIFF_ID = "2010473243-llp7zgX9";

document.addEventListener('DOMContentLoaded', () => {
    // 1. LIFFの初期化
    liff.init({ liffId: LIFF_ID }).then(() => {
        if (!liff.isLoggedIn()) {
            // LINEアプリ外で開かれた場合はLINEログインを促す
            liff.login(); 
        } else {
            checkRegistration();
        }
    }).catch(err => console.error("LIFF初期化失敗", err));

    // 2. 登録ボタンのイベント
    document.getElementById('save-name-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('genji-name-input').value.trim();
        if (nameInput === "") {
            alert("源氏名を入力してください");
            return;
        }
        // スマホのブラウザ内に源氏名を保存
        localStorage.setItem('castGenjiName', nameInput);
        checkRegistration(); // 画面を切り替える
    });

    // 3. 提出ボタンのイベント
    document.getElementById('submit-shift-btn').addEventListener('click', () => {
        submitShiftData();
    });
});

// 登録状態のチェックと画面切り替え
function checkRegistration() {
    const savedName = localStorage.getItem('castGenjiName');
    
    if (savedName) {
        // 登録済み：シフト入力画面を表示
        document.getElementById('register-section').style.display = 'none';
        document.getElementById('shift-section').style.display = 'block';
        document.getElementById('display-genji-name').textContent = savedName;
        
        // カレンダーの生成を実行
        generateShiftForm();
    } else {
        // 未登録：登録画面を表示
        document.getElementById('register-section').style.display = 'block';
        document.getElementById('shift-section').style.display = 'none';
    }
}

// ターゲットとなる「来週の月曜日」の日付を計算する関数
function getTargetMonday() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0:日, 1:月, 2:火, 3:水, 4:木, 5:金, 6:土

    // 次の月曜日までの日数を計算
    let daysUntilNextMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;

    // 【運用ルール】水曜締め切りのため、木曜(4)〜日曜(0)に開いた場合は「再来週」にする
    if (dayOfWeek >= 4 || dayOfWeek === 0) { 
        daysUntilNextMonday += 7; 
    }

    const targetMonday = new Date(today);
    targetMonday.setDate(today.getDate() + daysUntilNextMonday);
    
    return targetMonday;
}

// 月〜日の1週間分の日付配列（7日分）を生成する関数
function generateTargetWeekDates(baseDate) {
    const dates = [];
    for (let i = 0; i < 7; i++) {
        const currentDate = new Date(baseDate);
        currentDate.setDate(baseDate.getDate() + i);
        dates.push(currentDate);
    }
    return dates;
}

// 18:00〜27:00のプルダウンを生成する関数
function generateTimeOptions() {
    let options = '<option value="">休み</option>';
    for (let hour = 18; hour <= 27; hour++) {
        let displayHour = hour; 
        
        options += `<option value="${hour}:00">${displayHour}:00</option>`;
        if (hour !== 27) { // 27:30は作らない
            options += `<option value="${hour}:30">${displayHour}:30</option>`;
        }
    }
    return options;
}

// カレンダーフォームの生成（〇月〇日を自動表示）
function generateShiftForm() {
    const container = document.getElementById('calendar-container');
    container.innerHTML = ""; // 初期化
    
    const daysOfWeek = ["月", "火", "水", "木", "金", "土", "日"];
    const timeOptions = generateTimeOptions();

    // 対象となる月曜日の日付を取得し、1週間分の日付リストを生成
    const targetMonday = getTargetMonday();
    const targetDates = generateTargetWeekDates(targetMonday);

    // タイトルに「〇月〇日〜〇月〇日」と表示
    const startMonth = targetDates[0].getMonth() + 1;
    const startDate = targetDates[0].getDate();
    const endMonth = targetDates[6].getMonth() + 1;
    const endDate = targetDates[6].getDate();
    document.getElementById('target-week-title').textContent = 
        `対象期間: ${startMonth}/${startDate} 〜 ${endMonth}/${endDate}`;

    // 7日分の入力フォームを作成
    targetDates.forEach((date, index) => {
        const dateStr = `${date.getMonth() + 1}/${date.getDate()}`;
        const fullDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

        const html = `
            <div class="day-row">
                <div class="day-label">${dateStr} (${daysOfWeek[index]})</div>
                <div class="time-selects">
                    <select class="start-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                    <span class="time-separator">〜</span>
                    <select class="end-time" data-date="${fullDateStr}">
                        ${timeOptions}
                    </select>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

// 提出データをGASへ送信する関数
function submitShiftData() {
    const savedName = localStorage.getItem('castGenjiName');
    const shifts = [];

    const startElements = document.querySelectorAll('.start-time');
    const endElements = document.querySelectorAll('.end-time');

    startElements.forEach((startEl, index) => {
        const endEl = endElements[index];
        shifts.push({
            date: startEl.getAttribute('data-date'),
            start: startEl.value,
            end: endEl.value
        });
    });

    const submitData = {
        castName: savedName,
        shiftData: shifts
    };

    // ボタンの連打防止
    const submitBtn = document.getElementById('submit-shift-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = "送信中...";

    // 【重要】ここにGASの「ウェブアプリのURL」を貼り付けてください
    const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbyQfJe2XlHcUt5WWl7YEiggAGjJarZJ4U46g3ekrZ7xpAqB5eoQqr1437fTGSenw-JIOg/exec";

    // GASへデータをPOST送信
    fetch(GAS_WEB_APP_URL, {
        method: "POST",
        mode: "no-cors", // クロスドメイン通信のエラーを回避するための設定
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(submitData)
    })
    .then(() => {
        alert("シフトの提出が完了しました！");
        submitBtn.textContent = "提出完了";
        // LINEの画面を自動で閉じる（LINEアプリ内限定の機能）
        if (liff.isInClient()) {
            liff.closeWindow();
        }
    })
    .catch(err => {
        console.error("送信エラー:", err);
        alert("送信に失敗しました。電波状況の良い場所で再度お試しください。");
        submitBtn.disabled = false;
        submitBtn.textContent = "シフトを提出する";
    });
}