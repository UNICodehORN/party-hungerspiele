const API_BASE = "api/index.php";

// Elemente
const progressEl = document.getElementById("progress");
const stateEl = document.getElementById("state");
const highscoreList = document.getElementById("highscore-list");
const teamSelect = document.getElementById("teamSelect");
const playerSelect = document.getElementById("playerSelect");
const pointsForm = document.getElementById("pointsForm");
const nextRoundBtn = document.getElementById("nextRound");
const highscoreBtn = document.getElementById("highscore");
const resetGameBtn = document.getElementById("resetGame");

// Polling Interval
const POLL_INTERVAL = 2000;

// Globale Daten
let gameData = null;
const timerEl = document.getElementById("timer");
let countdownInterval = null;
let countdownEnded = false;

// Polling starten
setInterval(updateGameState, POLL_INTERVAL);
setInterval(updateHighscore, POLL_INTERVAL);

// Spielzustand laden
async function updateGameState() {
    try {
        const res = await fetch(`${API_BASE}?action=getGameState`);
        const data = await res.json();
        gameData = data; // speichern

        // Spielstatus anzeigen
        const state = data.gameState;

        // Gesamtzahl Spieler berechnen
        const totalPlayers = Object.values(data.teams)
            .reduce((sum, team) => sum + Object.keys(team.players || {}).length, 0);

        progressEl.textContent = `Runde ${state.round}/4`;
        stateEl.textContent = `${state.status.charAt(0).toUpperCase() + state.status.slice(1)} – Spieler: ${totalPlayers}`;

        // Spieler-Dropdown aktualisieren für gewähltes Team
        renderPlayersForTeam(teamSelect.value);

        // === Countdown-Logik ===
        const until = data.currentRound?.until ? new Date(data.currentRound.until).getTime() : null;

        if (until) {
            const now = Date.now();
            const remaining = until - now;

            if (remaining > 0) {
                document.getElementById("nextRound").disabled = true;
                document.getElementById("highscore").disabled = true;
                // Falls Timer noch nicht läuft oder sich "until" geändert hat -> neu starten
                if (!countdownInterval || countdownInterval.until !== until) {
                    if (countdownInterval) clearInterval(countdownInterval);
                    countdownEnded = false;

                    countdownInterval = setInterval(() => {
                        const now = Date.now();
                        const remaining = Math.max(0, until - now);

                        const seconds = Math.floor(remaining / 1000);
                        timerEl.textContent = `${seconds} s`;

                        if (remaining <= 0) {
                            clearInterval(countdownInterval);
                            countdownInterval = null;

                            if (!countdownEnded) {
                                document.getElementById("nextRound").disabled = false;
                                document.getElementById("highscore").disabled = false;
                                console.log("Runde abgelaufen!");
                                countdownEnded = true;
                            }
                        }
                    }, 1000);

                    // Zusatz: Speichere "until" in der Interval-Instanz
                    countdownInterval.until = until;
                }
            }
        } else {
            // Wenn keine Runde aktiv ist: Timer leeren
            timerEl.textContent = "-";
            if (countdownInterval) {
                clearInterval(countdownInterval);
                countdownInterval = null;
            }
        }

    } catch (err) {
        console.error("Fehler beim Laden des Spielzustands:", err);
    }
}



// Highscore aktualisieren
function updateHighscore() {
    if (!gameData) return;

    // Array aus Teams mit Summe der Punkte
    const scores = Object.entries(gameData.teams).map(([teamName, teamData]) => {
        const points = Object.values(teamData.players || {}).reduce((sum, p) => sum + (p.points || 0), 0);
        return { team: teamName, points };
    });

    // Sortieren absteigend
    scores.sort((a, b) => b.points - a.points);

    // Highscore-Liste rendern
    highscoreList.innerHTML = "";
    scores.forEach((entry, index) => {
        const li = document.createElement("li");
        li.textContent = `${index + 1}. ${entry.team} – ${entry.points} Punkte`;
        highscoreList.appendChild(li);
    });
}

// Spieler-Dropdown filtern
function renderPlayersForTeam(team) {
    playerSelect.innerHTML = "";
    if (!gameData || !gameData.teams[team]) return;

    const players = Object.values(gameData.teams[team].players || {});

    if (players.length === 0) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Keine Spieler";
        playerSelect.appendChild(option);
    } else {
        players.forEach(p => {
            const option = document.createElement("option");
            option.value = p.name;
            option.textContent = p.name;
            playerSelect.appendChild(option);
        });
    }
}

// Event: Team auswählen
teamSelect.addEventListener("change", () => {
    renderPlayersForTeam(teamSelect.value);
});

// Punkte vergeben
pointsForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const team = teamSelect.value;
    const player = playerSelect.value;
    const points = parseInt(document.getElementById("points").value) || 0;

    if (!team || !player) return;

    try {
        // Team + Spieler übergeben
        const url = `${API_BASE}?action=addPoints&team=${encodeURIComponent(team)}&player=${encodeURIComponent(player)}&points=${points}`;
        const res = await fetch(url);
        const result = await res.json();

        if (result.status === "ok") {
            await updateGameState();
            updateHighscore();
        } else {
            alert("Fehler: " + result.message);
        }
    } catch (err) {
        console.error("Fehler beim Punkte vergeben:", err);
    }
});


// Nächste Runde starten
nextRoundBtn.addEventListener("click", async () => {
    try {
        const url = `${API_BASE}?action=progressGame`;
        const res = await fetch(url);
        const result = await res.json();
        updateGameState();
    } catch (err) {
        console.error("Fehler beim Starten der nächsten Runde:", err);
    }
});

highscoreBtn.addEventListener("click", async () => {
    try {
        const url = `${API_BASE}?action=toggleHighscore`;
        const res = await fetch(url);
        const result = await res.json();
        await updateGameState();
    } catch (err) {
        console.error("Fehler beim Starten der nächsten Runde:", err);
    }
});

resetGameBtn.addEventListener("click", async () => {
    try {
        const url = `${API_BASE}?action=startGame`;
        const res = await fetch(url);
        const result = await res.json();
        document.getElementById("nextRound").disabled = false;
        document.getElementById("highscore").disabled = false;
        await updateGameState();
    } catch (err) {
        console.error("Fehler beim zurücksetzen:", err);
    }
});