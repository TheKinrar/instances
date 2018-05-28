const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Instance = require('./models/instance');

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
            }
        }
    });

    console.log(`${instances.length} instances to check`);

    for(let instance of instances) {
        console.log(instance.name);
    }

    process.exit(0);
})().catch(console.error);
