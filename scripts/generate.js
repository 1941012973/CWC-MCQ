const root = process.cwd();
const shuffle = require("lodash.shuffle");
const headers = { key: process.env.api_key };
const { readFileSync, writeFileSync } = require("fs");
const moment = require("moment")().utcOffset("+05:30");
const fetch = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));

(async function () {
    const assignment = [];

    const configs = JSON.parse(
        readFileSync(`${root}/functions/files/configs.json`, "utf-8")
    );

    const topics = shuffle(JSON.parse(
        readFileSync(`${root}/functions/files/topics.json`, "utf-8")
    ));

    const timetable = JSON.parse(
        readFileSync(`${root}/functions/files/timetable.json`, "utf-8")
    );

    const contributors = JSON.parse(
        readFileSync(`${root}/functions/files/contributors.json`, "utf-8")
    ).map((c) => ({ ...c, slots: 3 }));

    for (const [index, topic] of topics.entries()) {
        const assets = [];

        for (const contributor of contributors) {
            if (
                contributor.slots &&
                !topic.ignore.includes(contributor.code) &&
                !topic.coverage.includes(contributor.code) &&
                !configs.ignore.includes(contributor.code)
            ) {
                assets.push(contributor.code);
            }
        }

        if (topic.slots > assets.length) {
            topics[index]["coverage"] = [];
            contributors.forEach((contributor) => {
                if (
                    !topic.ignore.includes(contributor.code) &&
                    !configs.ignore.includes(contributor.code) &&
                    !assets.includes(contributor.code) &&
                    contributor.slots
                ) {
                    assets.push(contributor.code);
                }
            });
        }

        assets.reverse();
        for (let i = 0; i < topic.slots; i++) {
            if (!assets.length) break;
            const contributor = assets.pop();
            const child = contributors.findIndex((c) => c.code === contributor);
            assignment.push([topic.code, contributor]);
            topics[index].coverage.push(contributor);
            contributors[child].slots -= 1;
        }
    }

    configs.end = moment.endOf("week").unix();
    configs.start = moment.startOf("week").unix();
    const days = configs.days.map((day) => day.code);
    const slots = configs.slots.map((slot) => slot.code);

    for (const slot of slots) {
        for (const day of days) {
            if (day === "0" && slot === "S1") continue;
            if (assignment.length) {
                const [topic, assignee, ignore] = [...assignment.pop(), false];

                timetable[day][slot] = {
                    topic,
                    ignore,
                    assignee,
                };
            } else {
                timetable[day][slot] = {
                    topic: "",
                    assignee: "",
                };
            }
        }
    }
    

    writeFileSync(
        `${root}/functions/files/topics.json`,
        JSON.stringify(
            topics,
            (key, value) => (key === "count" ? undefined : value),
            4
        )
    );

    writeFileSync(
        `${root}/functions/files/timetable.json`,
        JSON.stringify(timetable, null, 4)
    );
    
    fetch(`${process.env.baseUrl}/telegram`, {
        body: String("New timetable generated. Once netlify deploys the site, Please find the updated timetable."),
        method: "POST",
        headers,
    });
})();
