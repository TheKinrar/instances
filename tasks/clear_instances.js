const pg = require('../pg');

module.exports = () => {
	const db_instances = DB.get('instances');

	// TODO new PG way of clearing never-up instances
	/*const delete_date = new Date();
	delete_date.setTime(delete_date.getTime() - (1000 * 60 * 60 * 24));

	db_instances.remove({
	    "upchecks": 0,
	    "$or": [
	    	{
			    "downchecks": {
			        "$gt": 0
			    }
	    	}, {
	            "addedAt": {
	                "$exists": false
	            }
	        }, {
	            "addedAt": {
	                "$lte": delete_date
	            }
	        }
	    ]
	});*/

	checkDeadInstances().then(() => {
		console.log('Cleared dead instances.');
	}).catch(console.error);
};

async function checkDeadInstances() {
    /* Delete old log entries (keeping the 100 newest) */

    for(let row of (await pg.query('SELECT DISTINCT ON (instance) instance FROM instances_log_entries;')).rows) {
        let old_log_entries = await pg.query('SELECT * FROM instances_log_entries WHERE instance=$1 ORDER BY id DESC OFFSET 100 ROWS', [
            row.instance
        ]);

        for(let entry of old_log_entries.rows) {
            await pg.query('DELETE FROM instances_log_entries WHERE id=$1', [entry.id]);
        }
	}

	return; // TODO: Fix this to use new PG history instead of Mongo

    /*const db_instances = DB.get('instances');
    const db_history = DB.get('history');

    const deadDate = new Date(new Date().getTime() - (7 * 24 * 60 * 60 * 1000));

    console.log('Looking for dead instances. Dead date: ' + deadDate);

    let instances = await db_instances.find({
        "up": false,
		"dead": {
        	"$ne": true
		}
    });

    for(let instance of instances) {
    	let history = await pg.query('SELECT FROM instances_history ' +
			'WHERE instance=(SELECT id FROM instances WHERE name=$1) ' +
			'AND  ' +
			'LIMIT 1;');

		let history = await db_history.findOne({
            "name": instance.name,
            "up": true,
            "date": {
                "$gt": deadDate
            }
        });

		if(!history) {
            console.log(instance.name + ' is dead.');

            /*await db_instances.update({
				_id: instance._id
			}, {
            	$set: {
            		dead: true
				}
			});*/
		}
	}*/
}