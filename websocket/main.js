

const WebSocket = require('ws');
const words = require("./words.json");

/*
0 -> {
    "sid": "Ga-byjigiD3HL6oJAjtw",
    "upgrades": [],
    "pingInterval": 5000,
    "pingTimeout": 20000,
    "maxPayload": 81920
}

40 -> {
    "sid": "py5jGPEqDXHAmhdbAjty"
}

42 -> [
    "login",
    {
        "join": "",
        "create": 0,
        "name": "oka",
        "lang": "0",
        "avatar": [
            1,
            6,
            43,
            -1
        ]
    }
]
*/
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))
function RandomStr(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
function CreatWebSocketServer(port) {
    let banList = [];
    let game = {
        settings: [0, 8, 80, 3, 3, 2, 0, 0],
        round: 0,
        owner: -1,
        id: RandomStr(),
        state: {
            id: 7,
            time: 0,
            data: 0
        },
        type: 0,
        users: [],
    };
    let network = {
        index: 0,
        users: {},
        turn: -1,
        sendTo: function (index, op, data) {
            this.send(this.users[index].ws, op, data);
        },
        send: function (ws, op, data) {
            ws.send(op + (data ? JSON.stringify(data) : ""))
        },
        sendAll: function (index, op, data) {
            Object.entries(this.users).forEach(([k, l]) => k != index ? this.send(l.ws, op, data) : 0)
        },
        parse: function (str) {
            let s = "", i = 0;
            while (!isNaN(Number(str[i]))) {
                s += str[i]
                i++;
            }
            let op = Number(s),
                data = str.slice(2) == "" ? null : JSON.parse(str.slice(2))
            return { op, data }
        },
        computeScore: function () {
            const maxScore = 300, minScore = 10;
            let len = Object.values(this.users).filter(l => l.score).length;
            let score = Math.floor(maxScore - len * maxScore * 0.25);
            return Math.max(minScore, score)
        },
        add: function (ws) {
            this.index++;
            this.users[this.index] = { ws };
            return this.index;
        },
        remove: function (id) {
            delete this.users[id];
        }
    };
    const wss = new WebSocket.Server({ port });
    console.log('WebSocket server is running on ws://localhost:' + port);

    let turnIndex = 0;
    function getUserTurn() {
        let keys = Object.keys(network.users).map(l => Number(l));
        return keys[turnIndex++] || keys[turnIndex = 0];
    }
    function getGuessAccuracy(word, guess) {
        if (guess === word) return 1;

        const distance = levenshteinDistance(word, guess);
        const similarity = 1 - distance / Math.max(word.length, guess.length);

        return similarity >= 0.7 ? 2 : 0;
    }

    function levenshteinDistance(a, b) {
        const matrix = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }

        return matrix[b.length][a.length];
    }
    network.round = 0;
    async function StartGame() {
        network.started = true;
        game.state = { id: 2, time: 2, data: network.round };
        network.sendAll(NaN, 42, ["data", {
            id: 11,
            data: game.state,
        }]);
        await sleep(2e3);
        network.turn = getUserTurn();
        game.state = {
            id: 3,
            time: 15,
            data: {
                id: network.turn,
            }
        };
        let chooseWorldTimeData = {
            id: 11,
            data: Object.assign({}, game.state),
        }
        network.sendAll(network.turn, 42, ["data", chooseWorldTimeData]);
        let rIndex = Math.floor(Math.random() * (words.length - 3))
        const words_ = words.slice(rIndex, rIndex + 3);
        chooseWorldTimeData.data.data.words = words_;
        network.words = words_;
        network.send(network.users[network.turn].ws, 42, ["data", chooseWorldTimeData]);
        await sleep(15e3);
        if (game.state.data.word?.[0]) return;
        StartRound(0);
    }
    function getSettings(key) {
        let entries = {
            LANG: 0,
            SLOTS: 1,
            DRAWTIME: 2,
            ROUNDS: 3,
            WORDCOUNT: 4,
            HINTCOUNT: 5,
            WORDMODE: 6,
            CUSTOMWORDSONLY: 7
        }
        return game.settings[entries[key]];
    }
    function makeHint() {
        const usedIndexes = new Set(game.state.data.hints.map(hint => hint[0]));
        const validIndexes = [];

        for (let i = 0; i < network.word.length; i++) {
            const char = network.word[i];
            if (!usedIndexes.has(i) && char.trim() !== '') {
                validIndexes.push(i);
            }
        }

        if (validIndexes.length === 0) return null; // no more hints

        const randIndex = validIndexes[Math.floor(Math.random() * validIndexes.length)];
        return [randIndex, network.word[randIndex]];
    }
    function getScores() {
        //id , totalScore , addedScore
        //rank
        let scores = [];
        let entries = Object.entries(network.users);
        entries.forEach(([id, v]) => {
            id = Number(id);
            let user = game.users.find(l => l.id == id);
            //let score = 0;
            if (network.turn !== id) {
                v.score ??= 0;
                user.score += v.score;
                scores.push(id, user.score, v.score)
            } else {
                let len = entries.filter(l => l[1].score && l[0] !== id).length;
                let score = Math.max(10, (300 / entries.length - len));
                console.log("turn.score", score);
                user.score += score;
                scores.push(id, user.score, score);
            }
        });
        return scores;
    }
    async function FinishGame() {
        game.state = {
            id: 6,
            time: 7,
            data: game.users.slice().sort((a, b) => b.score - a.score).map((user, index) => [user.id, index, 0])
        }
        network.sendAll(NaN, 42, ["data", {
            id: 11,
            data: game.state
        }]);
        await sleep(7e3);
        game.state = { id: 7, time: 0, data: 0 }
        network.sendAll(NaN, 42, ["data", {
            id: 11,
            data: game.state
        }]);
        game.users.forEach(l => l.score = 0);
        network.started = true;
    }
    async function FinishRound() {
        network.finish = true;
        game.state.id = 5;
        let scores = getScores();
        console.log(scores)
        game.state.data = {
            reason: 1,
            scores,
            word: network.word,
        }
        network.sendAll(NaN, 42, ["data", {
            id: 11,
            data: game.state
        }]);
        await sleep(2e3);
        network.finish = false;
        network.turn = null;
        Object.keys(network.users).forEach(l => network.users[l].score = null);
        network.words = null;
        game.users.forEach(l => l.guessed = false);
        if (network.round > 2) {
            console.log("Rounds Over");
            FinishGame();
            return;
        }
        StartGame();
    }
    function getPreloadedHints(word) {
        const result = [];
        for (let i = 0; i < word.length; i++) {
            const char = word[i];
            if (char === ' ' || char === '-') {
                result.push([i, char]);
            }
        }
        return result;
    }
    function StartRound(index) {
        let word = network.words[index];
        network.word = word;
        game.state.data.hints = getPreloadedHints(word);
        game.state.data.drawCommands = [];
        game.state.data.word = word.split(" ").map(l => l.length)
        game.state.data.id = network.turn;
        game.state.time = getSettings("DRAWTIME");
        game.state.id = 4

        async function updateTime() {
            while (game.state.time > 0 && game.state.id == 4) {
                await sleep(1e3);
                game.state.time -= 1;
                if (game.state.time % 20 === 0 && game.state.data.hints.length < network.word.replaceAll(" ", "").length) {
                    let hint = makeHint();
                    game.state.data.hints.push(hint);
                    network.sendAll(network.turn, 42, ["data", {
                        id: 13,
                        data: [hint]
                    }]);
                }
                if (game.users.filter(l => l.guessed).length + 1 === game.users.length && !network.finish) FinishRound();
            }
            if (!network.finish) FinishRound();
        }
        updateTime();

        network.sendAll(network.turn, 42, ["data", {
            id: 11,
            data: game.state
        }]);
        network.send(network.users[network.turn].ws, 42, ["data", {
            id: 11,
            data: { ...game.state, data: { id: network.turn, word } }
        }]);
    }
    wss.on('connection', (ws) => {
        //let PacketHandler_ = new PacketHandler(ws);
        const myid = network.add(ws);
        let user = network.users[myid];
        console.log(myid);
        network.send(ws, 0, {
            "sid": "-XqR9J6_EfuEsZ4UBDRB",
            "upgrades": [],
            "pingInterval": 5000,
            "pingTimeout": 20000,
            "maxPayload": 81920
        });
        user.stat = 0;
        ws.on('message', (message) => {
            let { op, data } = network.parse(new TextDecoder().decode(message));
            if (op !== 3) console.log({ op, data });
            switch (op) {
                case 40: {
                    if (user.stat === 0) {
                        network.send(ws, 40, {
                            "sid": "orO0Xr5qHsast12FAntM"
                        });
                        user.stat = 40;
                    }
                }
                    break;
                case 42: {
                    switch (data[0]) {
                        case "login": {
                            if (user.stat === 40) {
                                const { name, avatar, create } = data[1];
                                if (name.length < 2) name = "Player " + myid;
                                let user_ = { name, avatar, id: myid, guessed: false, score: 0, flags: 0, }
                                game.users.push(user_);
                                network.sendAll(myid, 42, ["data", { data: user_, id: 1 }]);
                                setInterval(() => {
                                    network.send(ws, 2);
                                }, 6e3);

                                if (create === 1) game.owner = myid;
                                network.send(ws, 42, ["data", { id: 10, data: { ...game, me: myid } }]);
                                user.stat = 42;
                            }
                        }
                            break;
                        case "data": {
                            const { data: d, id } = data[1];
                            switch (id) {
                                case 3: {//kick
                                    if (game.owner == myid) {
                                        const reason = 1;
                                        network.sendAll(d, 42, ["data", { id: 2, data: { id: d, reason } }]);
                                        network.sendTo(d, 42, ["reason", reason])
                                        network.sendTo(d, 41);
                                        network.users[d].ws.close();
                                    }
                                }
                                    break;
                                case 4: {//ban
                                    if (game.owner == myid) {
                                        const reason = 2;
                                        network.sendAll(d, 42, ["data", { id: 2, data: { id: d, reason } }]);
                                        network.sendTo(d, 42, ["reason", reason]);
                                        network.users[d].ws.close();
                                    }
                                }
                                    break;
                                case 5: { //vote-kick

                                }
                                    break;
                                case 8: { //
                                    network.sendAll(NaN, 42, ["data", {
                                        id: 8,
                                        data: { id: myid, vote: d }
                                    }]);
                                }
                                    break;
                                case 12: {//game settings
                                    if (user.stat !== 42 || myid !== game.owner) return;
                                    game.settings[Number(d.id)] = Number(d.val);
                                    network.sendAll(NaN, 42, data);
                                }
                                    break;
                                case 18: {//choose word
                                    if (network.words && myid == network.turn) StartRound(d);
                                }
                                    break;
                                case 19: {//draw
                                    if (myid == network.turn && game.state.data?.word?.[0]) {
                                        game.state.data.drawCommands.push(...d);
                                        network.sendAll(myid, 42, data);
                                    }
                                }
                                    break;
                                case 20: {//clear
                                    if (myid == network.turn && game.state.data?.word?.[0]) {
                                        game.state.data.drawCommands = [];
                                        network.sendAll(myid, 42, data);
                                    }
                                }
                                    break;
                                case 21: {//undo
                                    if (myid == network.turn && game.state.data?.word?.[0]) {
                                        game.state.data.drawCommands = game.state.data.drawCommands.slice(0, d);
                                        network.sendAll(myid, 42, data);
                                    }
                                }
                                    break;
                                case 22: {//game stat
                                    let words_ = d.split(",").filter(l => l != "");
                                    if (words_.length > 10) words = words_;
                                    if (myid === game.owner && !network.started) StartGame();

                                }
                                    break;
                                case 30: {//chat
                                    if (d.length === 0) return;
                                    let flag2 = game.users.find(l => l.id == myid).guessed;
                                    if (myid !== network.turn && game.state.data?.word?.[0]) {
                                        let flag = getGuessAccuracy(network.word, d);
                                        //console.log(flag, d);
                                        if (flag == 0) {
                                            network.sendAll(NaN, 42, ["data", { id: 30, data: { id: myid, msg: d } }]);
                                        } else if (flag == 1) {
                                            network.sendAll(NaN, 42, ["data", { id: 14, data: 32 }]);
                                            network.sendAll(myid, 42, ["data", { id: 15, data: { id: myid } }]);
                                            network.send(ws, 42, ["data", { id: 15, data: { id: myid, word: network.word } }]);
                                            game.users.find(l => l.id == myid).guessed = true;
                                            user.score = network.computeScore();
                                        } else if (flag == 2) network.send(ws, 42, ["data", { id: 16, data: d }]);
                                    } else if (myid === network.turn || flag2) {
                                        network.send(ws, 42, ["data", { id: 30, data: { id: myid, msg: d } }]);
                                        game.users.filter(l => l.guessed).map(l => l.id).forEach(id => {
                                            network.sendTo(id, 42, ["data", { id: 30, data: { id: myid, msg: d } }])
                                        });
                                    } else network.sendAll(NaN, 42, ["data", { id: 30, data: { id: myid, msg: d } }]);

                                }
                                    break;
                            }
                        }
                    }
                }
                    break;
            }
        });
        ws.on('close', () => {
            game.users.splice(game.users.findIndex(l => l.id == myid), 1);
            network.remove(myid);
            network.sendAll(myid, 42, ["data", { id: 2, data: { id: myid, reason: 0 } }]);
        });
        ws.on('error', (error) => {
            console.error(`WebSocket error: ${error}`);
        });
    });

}

module.exports = CreatWebSocketServer;

