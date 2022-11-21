const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const Instance = require('./models/instance');
const PromisePool = require('es6-promise-pool');

const checkInstance = require('./jobs/check_instance');

setTimeout(() => {
    console.error('Looks like we stalled!');
    process.exit(1);
}, 3600_000);

(async () => {
    let fiveMinutesBefore = new Date();
    fiveMinutesBefore.setMinutes(fiveMinutesBefore.getMinutes() - 5);
    let oneDayBefore = new Date();
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);

    let instances = await Instance.findAll({
        where: {
            [Op.or]: [{
                latest_check: {
                    [Op.eq]: null
                }
            }, {
                dead: false,
                latest_check: {
                    [Op.lt]: fiveMinutesBefore
                }
            }, {
                latest_check: {
                    [Op.lt]: oneDayBefore
                }
            }]
        }
    });

    console.log(`${instances.length} instances to check`);
    let start = new Date();

    await (new PromisePool(() => {
        if(instances.length === 0)
            return null;

        return checkInstance({
            instance: instances.splice(0, 1)[0].id
        });
    }, 50)).start();

    console.log(`Done in ${(new Date().getTime() - start.getTime()) / 1000} s.`);
    process.exit(0);
})().catch(console.error);
