const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Instance = require('./models/instance');

const checkInstance = require('./jobs/check_instance');

(async () => {
    let fiveMinutesBefore = new Date();
    fiveMinutesBefore.setMinutes(fiveMinutesBefore.getMinutes() - 5);

    let instances = await Instance.findAll({
        where: {
            latest_check: {
                [Op.or]: {
                    [Op.lt]: fiveMinutesBefore,
                    [Op.eq]: null
                }
            },
            dead: false
        }
    });

    console.log(`${instances.length} instances to check`);
    let start = new Date();

    while(instances.length > 0) {
        await Promise.all(instances.splice(0, 100).map(i => {
            return checkInstance({
                instance: i.id
            });
        }));
    }

    console.log(`Done in ${(new Date().getTime() - start.getTime()) / 1000} s.`);
    process.exit(0);
})().catch(console.error);
