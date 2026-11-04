// ---------- Konfiguration / Globals ----------
const API_BASE = "api/index.php";
const API_URL = `${API_BASE}?action=getGameState`;

const waitingStartView = document.getElementById("waitingStart");
const loginView = document.getElementById("loginView");
const waitingRoundView = document.getElementById("waitingRound");
const roundView = document.getElementById("roundView");

const loginForm = document.getElementById("loginForm");
const playerNameInput = document.getElementById("playerName");
const teamSelect = document.getElementById("teamSelect");

const displayPlayerName = document.getElementById("displayPlayerName");
const displayPoints = document.getElementById("displayPoints");
const displayRank = document.getElementById("displayRank");

const roundForm = document.getElementById("roundForm");
const roundDateInput = document.getElementById("roundDate");
const roundTimerEl = document.getElementById("roundTimer");
const roundTimerBar = document.getElementById("roundTimerBar");
const roundTimerBarContainer = document.getElementById("timerBarContainer");
const rank = document.getElementById("rank");

roundDateInput.max = new Date().toISOString().split("T")[0];

const STORAGE_KEY = "weddingPartyGamePlayer";

let currentPlayer = loadPlayer();
let playerId = null;
let gameStateStored = null;
let latestRound = null;
let currentRoundId = null;
let answered = false;
let timerInterval = null;

// Sprachpakete
const translations = {
    "de": {
        waitingStart: "Bitte warten auf Spielbeginn...",
        waitingRound: "Bitte warten auf die nächste Runde...",
        errorAddPlayer: "Fehler beim Hinzufügen des Spielers:",
        errorLoadState: "Fehler beim Laden des GameState",
        errorCheckAnswered: "Fehler beim Prüfen ob bereits geantwortet:",
        errorSend: "Fehler beim Senden",
        errorLoadPlayerId: "Fehler beim Laden der playerId:",
        errorPlayerNotFound: "Spieler nicht gefunden:",
        answerSent: "Antwort übermittelt.",
        waitingRoundData: "Warte auf Rundendaten...",
        timeUp: "Zeit abgelaufen!",
        secondsLeft: (s) => `noch ${s} Sekunden`,
        table:  "Tisch",
        questionFallback: "Frage",
        chooseDate: "Wähle ein Datum:",
        submit: "Abschicken",
        waitingStartText: "Bitte warten auf Spielbeginn...",
        loginInfoText: "Bitte melde dich an:",
        loginButton: "Mitspielen",
        roundDateLabel: "Wähle ein Datum:",
        roundFormButton: "Abschicken",
        rankTeamLabel: "Team:",
        rankPlayerLabel: "Du:",
        roundAlreadyRunning: "Die Runde läuft bereits.",
        points: "Punkte",
        rank: ". Platz"
    },
    "pt": {
        waitingStart: "Aguardando o início do jogo...",
        waitingRound: "Aguardando a próxima rodada...",
        errorAddPlayer: "Erro ao adicionar jogador:",
        errorLoadState: "Erro ao carregar o estado do jogo",
        errorCheckAnswered: "Erro ao verificar se já respondeu:",
        errorSend: "Erro ao enviar",
        errorLoadPlayerId: "Erro ao carregar playerId:",
        errorPlayerNotFound: "Jogador não encontrado:",
        answerSent: "Resposta enviada.",
        waitingRoundData: "Aguardando dados da rodada...",
        timeUp: "Tempo esgotado!",
        table: "Mesa",
        secondsLeft: (s) => `faltam ${s} segundos`,
        questionFallback: "Pergunta",
        chooseDate: "Escolha uma data:",
        submit: "Enviar",
        waitingStartText: "Aguarde o início do jogo...",
        loginInfoText: "Por favor, faça login:",
        loginButton: "Jogar",
        roundDateLabel: "Escolha uma data:",
        roundFormButton: "Enviar",
        rankTeamLabel: "Equipe:",
        rankPlayerLabel: "Você:",
        roundAlreadyRunning: "A rodada já está em andamento.",
        points: "Pontos",
        rank: "º Lugar"

    },
    "pl": {
        waitingStart: "Proszę czekać na rozpoczęcie gry...",
        waitingRound: "Proszę czekać na następną rundę...",
        errorAddPlayer: "Błąd podczas dodawania gracza:",
        errorLoadState: "Błąd podczas ładowania stanu gry",
        errorCheckAnswered: "Błąd podczas sprawdzania odpowiedzi:",
        errorSend: "Błąd podczas wysyłania",
        errorLoadPlayerId: "Błąd podczas ładowania playerId:",
        errorPlayerNotFound: "Nie znaleziono gracza:",
        answerSent: "Odpowiedź wysłana.",
        waitingRoundData: "Oczekiwanie na dane rundy...",
        timeUp: "Czas minął!",
        table: "Tabela",
        secondsLeft: (s) => `pozostało ${s} sekund`,
        questionFallback: "Pytanie",
        chooseDate: "Wybierz datę:",
        submit: "Wyślij",
        waitingStartText: "Proszę czekać na rozpoczęcie gry...",
        loginInfoText: "Proszę się zalogować:",
        loginButton: "Graj",
        roundDateLabel: "Wybierz datę:",
        roundFormButton: "Wyślij",
        rankTeamLabel: "Zespół:",
        rankPlayerLabel: "Ty:",
        roundAlreadyRunning: "Runda już trwa.",
        points: "Punkty",
        rank: ". Miejsce"
    }
};

// Sprache laden oder Overlay anzeigen
let currentLang = localStorage.getItem("lang");

document.addEventListener("DOMContentLoaded", () => {
    const switcher = document.getElementById("languageSwitcher");
    if (switcher) {
        switcher.querySelectorAll("[data-lang]").forEach(button => {
            button.addEventListener("click", () => {
                const lang = button.dataset.lang;
                setLanguage(lang);
                console.log("Sprache gewechselt zu:", lang);
            });
        });
    }
});
function setLanguage(lang) {
    currentLang = lang;
    localStorage.setItem("lang", lang);
    document.getElementById("langOverlay").style.display = "none";
    // Texte sofort aktualisieren
    document.querySelector("label[for='roundDate']").textContent = t("chooseDate");
    document.querySelector("#roundForm button").textContent = t("submit");
    setTexts();
    gameStateStored = {};
    checkGameState();
}

if (!currentLang) {
    document.getElementById("langOverlay").style.display = "flex";
    document.querySelectorAll("#langDialog .flags [data-lang]").forEach(button => {
        button.addEventListener("click", () => {
            setLanguage(button.dataset.lang);
            setTexts();
        });
    });
} else {
    // Sprache aus Storage setzen
    setLanguage(currentLang);
    setTexts();
}
function t(key, ...args) {
    if (currentLang === null){
    }
    else {
        const entry = translations[currentLang][key];
        return typeof entry === "function" ? entry(...args) : entry;
    }
}

function setTexts() {
    document.getElementById("waitingStartText").textContent = t("waitingStartText");
    document.getElementById("loginInfoText").textContent = t("loginInfoText");
    document.getElementById("loginButton").textContent = t("loginButton");
    document.getElementById("roundDateLabel").textContent = t("roundDateLabel");
    document.getElementById("roundFormButton").textContent = t("roundFormButton");
    document.getElementById("rankTeamLabel").textContent = t("rankTeamLabel");
    document.getElementById("rankPlayerLabel").textContent = t("rankPlayerLabel");

    // Team-Select Optionen dynamisch setzen
    const teamSelect = document.getElementById("teamSelect");
    teamSelect.innerHTML = ""; // vorher löschen
    for (let i = 1; i <= 10; i++) {
        const opt = document.createElement("option");
        opt.value = `Tisch${i}`;
        opt.textContent = t("table")+i;
        teamSelect.append(opt);
    }

    // Placeholder für Spielername (falls gewünscht)
    const playerNameInput = document.getElementById("playerName");
    playerNameInput.placeholder = currentLang === "de" ? "Spielername" :
        currentLang === "pl" ? "Nazwa gracza" :
            "Nome do jogador";
}
// Falls Spieler gespeichert ist: Felder füllen und playerId laden
if (currentPlayer) {
    playerNameInput.value = currentPlayer.name;
    teamSelect.value = currentPlayer.team || "";
    loadPlayerId();
}

// Labels übersetzen
document.querySelector("label[for='roundDate']").textContent = t("chooseDate");
document.querySelector("#roundForm button").textContent = t("submit");
// Polling
setInterval(checkGameState, 2000);

// ---------- LocalStorage Spieler ----------
function savePlayer(player) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(player));
}
function loadPlayer() {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
}

// ---------- View-Wechsel ----------
function showView(view) {
    [waitingStartView, loginView, waitingRoundView, roundView].forEach(v => v.classList.remove("active"));
    view.classList.add("active");
}

// ---------- Login ----------
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = playerNameInput.value.trim();
    const team = teamSelect.value;
    if (!name || !team) return;

    currentPlayer = { name, team};
    savePlayer(currentPlayer);

    try {
        const url = `${API_BASE}?action=addPlayer&player=${encodeURIComponent(name)}&team=${encodeURIComponent(team)}`;
        const res = await fetch(url);
        const result = await res.json();

        if (result.status === "ok") {
            showWaitingRound();
            await loadPlayerId();
        } else {
            alert(t("errorAddPlayer") + " " + result.message);
        }
    } catch (err) {
        console.error(t("errorAddPlayer"), err);
    }
});

// ---------- Waiting UI ----------
function showWaitingRound() {
    showView(waitingRoundView);
    const infoTextEl = waitingRoundView.querySelector("p");
    if (currentPlayer) {
        displayPlayerName.textContent = currentPlayer.name+" - "+currentPlayer.team;
        waitingRoundView.querySelector("p").textContent = t("waitingStart");
        loadPlayerInfo();
    }
    else {
        displayPlayerName.textContent = "";
        infoTextEl.textContent = t("roundAlreadyRunning");
    }
}

// ---------- checkGameState ----------
async function checkGameState() {
    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(t("errorLoadState"));
        const data = await res.json();
        const serialized = JSON.stringify(data);

        if (serialized !== gameStateStored) {
            gameStateStored = serialized;

            const game = data.gameState;
            const round = data.currentRound;

            // Neue Runde -> answered zurücksetzen
            if (round.round !== currentRoundId) {
                currentRoundId = round.round;
                answered = false;
            }

            latestRound = round;

            if (game.round === 0 && game.roundProgress === 0) {
                answered = false;
                showView(waitingStartView);
            } else if (game.round === 0 && game.roundProgress === 1) {
                let id = await loadPlayerId();
                if (id === null)
                    showView(loginView);
                else
                    showWaitingRound();
            } else if (currentPlayer != null && round.round > 0 && round.roundProgress >= 0) {
                await alreadyAnswered(round);
            } else {
                showWaitingRound();
            }
        }
    } catch (err) {
        console.error(t("errorLoadState"), err);
    }
}

// ---------- alreadyAnswered ----------
async function alreadyAnswered(round) {
    if (!round || !playerId) {
        showRoundView(round);
        return;
    }

    const url = "data/answer.json";
    const teamName = currentPlayer.team;
    const player = playerId;

    try {
        const res = await fetch(url);
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};

        answered = !!(data[teamName] && data[teamName][player]);
        showRoundView(round);
    } catch (err) {
        console.error(t("errorCheckAnswered"), err);
        showRoundView(round);
    }
}

// ---------- showRoundView ----------
// Quiz-Elemente
const quizForm = document.getElementById("quizForm");
const quizQuestion = document.getElementById("quizQuestion");
const quizAnswers = document.getElementById("quizAnswers");

// ---------- showRoundView ----------
function showRoundView(round) {
    showView(roundView);

    if (!round) return;

    if (answered) {
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        roundTimerEl.textContent = t("answerSent");
        roundTimerBar.style.width = "0%";
        roundForm.style.display = 'none';
        quizForm.style.display = 'none';
        refreshRank();
        return;
    }
    rank.style.display = 'none';

    if (round.roundProgress === 0) {
        if (currentLang !== "de")
            roundTimerEl.textContent = round["intro_"+currentLang];
        else
            roundTimerEl.textContent = round.intro;
        roundForm.style.display = 'none';
        quizForm.style.display = 'none';
        roundTimerBarContainer.style.display = "none";
    }
    else {
        if (!round.until) {
            roundTimerEl.textContent = t("waitingRoundData");
            roundForm.style.display = 'block';
            quizForm.style.display = 'none';
            roundTimerBarContainer.style.display = "block";
            roundTimerBar.style.width = "0%";
            return;
        }

        if (timerInterval) clearInterval(timerInterval);

        const until = new Date(round.until).getTime();
        const total = until - Date.now();

        if (total <= 0) {
            roundTimerEl.textContent = t("timeUp");
            roundTimerBar.style.width = "0%";
            roundForm.style.display = 'none';
            quizForm.style.display = 'none';
            refreshRank();
            return;
        }

        // Modulabhängig anzeigen
        if (round.module === "quiz") {
            roundForm.style.display = 'none';
            quizForm.style.display = 'block';

            // Frage setzen
            const translatedQuestion = round.element[`question_${currentLang}`];
            quizQuestion.textContent = currentLang === "de"
                ? round.element.question || t("questionFallback")
                : translatedQuestion || round.element.question || t("questionFallback");

            // Antworten rendern
            quizAnswers.innerHTML = "";
            const answerList = currentLang === "de"
                ? round.element.answers
                : round.element[`answers_${currentLang}`] || round.element.answers;
            (answerList || []).forEach((answer, idx) => {
                const btn = document.createElement("button");

                btn.textContent = answer;
                btn.classList.add("answerBtn");
                btn.addEventListener("click", async (e) => {
                    e.preventDefault();
                    await submitQuizAnswer(idx);
                });
                quizAnswers.appendChild(btn);
            });
        } else {
            roundForm.style.display = 'block';
            quizForm.style.display = 'none';
        }

        roundTimerBarContainer.style.display = "block";
        timerInterval = setInterval(() => {
            const remaining = until - Date.now();
            if (remaining <= 0) {
                clearInterval(timerInterval);
                timerInterval = null;
                roundTimerEl.textContent = t("timeUp");
                roundTimerBar.style.width = "0%";
                roundForm.style.display = 'none';
                quizForm.style.display = 'none';
                return;
            }
            const seconds = Math.floor((remaining % 60000) / 1000);
            roundTimerEl.textContent = t("secondsLeft", seconds);
            roundTimerBar.style.width = `${(remaining / total) * 100}%`;
        }, 500);
    }
}

// ---------- Submit Quiz ----------
async function submitQuizAnswer(answerIndex) {
    if (!latestRound) return;
    try {
        const response = await fetch(
            `${API_BASE}?action=addAnswer&player=${encodeURIComponent(currentPlayer.name)}&team=${encodeURIComponent(currentPlayer.team)}&answer=${encodeURIComponent(answerIndex)}`
        );
        if (!response.ok) throw new Error(t("errorSend"));

        await response.json();

        answered = true;
        showRoundView(latestRound);
    } catch (err) {
        console.error(t("errorSend"), err);
    }
}

// ---------- Submit der Antwort ----------
roundForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!latestRound) return;
    const chosenDate = roundDateInput.value;
    if (!chosenDate) return;

    try {
        const response = await fetch(
            `${API_BASE}?action=addAnswer&player=${encodeURIComponent(currentPlayer.name)}&team=${encodeURIComponent(currentPlayer.team)}&answer=${encodeURIComponent(chosenDate)}`
        );
        if (!response.ok) throw new Error(t("errorSend"));

        await response.json();

        answered = true; // Formular ausblenden, Anzeige anpassen
        showRoundView(latestRound);
    } catch (err) {
        console.error(t("errorSend"), err);
    }
});

// ---------- loadPlayerId ----------
async function loadPlayerId() {
    if (!currentPlayer) return null;

    try {
        const res = await fetch(API_URL);
        if (!res.ok) throw new Error(t("errorLoadPlayerId"));
        const data = await res.json();

        const team = data.teams?.[currentPlayer.team];
        if (!team) {
            console.log(`Team "${currentPlayer.team}" nicht gefunden.`);
            return null;
        }

        const players = team.players || {};
        for (const [id, pl] of Object.entries(players)) {
            if (pl.name === currentPlayer.name) {
                playerId = id;
                return id;
            }
        }

        console.log(`Spieler "${currentPlayer.name}" NICHT im Team "${currentPlayer.team}" gefunden.`);
        localStorage.clear();
        return null;
    } catch (error) {
        console.error(t("errorLoadPlayerId"), error);
        return null;
    }
}
function refreshRank() {
    // JSON parsen
    const gameState = JSON.parse(gameStateStored);

    const teams = gameState.teams;

    let allPlayers = [];
    let teamScores = {};

    // Alle Spieler + Punkte sammeln & Team-Punkte berechnen
    for (const [teamName, teamData] of Object.entries(teams)) {
        let teamPoints = 0;

        for (const [pid, playerData] of Object.entries(teamData.players)) {
            allPlayers.push({
                id: pid,
                name: playerData.name,
                points: playerData.points,
                team: teamName,
            });
            teamPoints += playerData.points;
        }

        teamScores[teamName] = teamPoints;
    }

    // Sortiere Spieler nach Punkten absteigend
    allPlayers.sort((a, b) => b.points - a.points);

    // Platzierungen vergeben (mit Punktgleichstand)
    let playerRanks = {};
    let lastPoints = null;
    let lastRank = 0;

    allPlayers.forEach((p, index) => {
        if (p.points !== lastPoints) {
            lastRank = index + 1;
            lastPoints = p.points;
        }
        playerRanks[p.name + "_" + p.team] = lastRank;
    });

    // Sortiere Teams nach Punkten absteigend
    let teamSorted = Object.entries(teamScores).sort((a, b) => b[1] - a[1]);

    let teamRanks = {};
    lastPoints = null;
    lastRank = 0;

    teamSorted.forEach(([teamName, points], index) => {
        if (points !== lastPoints) {
            lastRank = index + 1;
            lastPoints = points;
        }
        teamRanks[teamName] = lastRank;
    });

    // Aktueller Spieler ermitteln
    const playerKey = currentPlayer.name + "_" + currentPlayer.team;
    const playerData = allPlayers.find(
        (p) => p.name === currentPlayer.name && p.team === currentPlayer.team
    );

    if (!playerData) {
        console.error(t("errorPlayerNotFound"), currentPlayer);
        return null;
    }

    const result = {
        player: {
            name: playerData.name,
            team: playerData.team,
            points: playerData.points,
            rank: playerRanks[playerKey],
        },
        team: {
            name: currentPlayer.team,
            points: teamScores[currentPlayer.team],
            rank: teamRanks[currentPlayer.team],
        },
    };

    const pts = document.getElementById("points");
    const ptsTeam = document.getElementById("pointsTeam");
    const rankPlayer = document.getElementById("rankPlayer");
    const rankTeam = document.getElementById("rankTeam");
    pts.textContent = result.player.points+" "+t("points");
    ptsTeam.textContent = result.team.points+" "+t("points");
    rankPlayer.textContent = " ("+result.player.rank+t("rank")+")";
    rankTeam.textContent = " ("+result.team.rank+t("rank")+")";
    rank.style.display = 'block';
    loadPlayerInfo(result);
    return result;
}

function loadPlayerInfo(result){
    // Teaminfo im Header anzeigen
    const teamInfo = document.getElementById("teamInfo");
    teamInfo.style.display = 'flex';
    const playerTeamNameEl = document.getElementById("playerTeamName");
    const teamRankEl = document.getElementById("teamRank");

    if (playerTeamNameEl && teamRankEl && currentPlayer) {
        playerTeamNameEl.textContent = currentPlayer.name;
        if (result != undefined)
            teamRankEl.textContent = ` (${result.team.rank}${t("rank")})`;
    }
}