module.exports = () => {
	const db_instances = DB.get('instances');

	const delete_date = new Date();
	delete_date.setTime(delete_date.getTime() - (1000 * 60 * 60));

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
	});

	checkDeadInstances().then(() => {
		console.log('Cleared dead instances.');
	}).catch(console.error);
};

async function checkDeadInstances() {
    const db_instances = DB.get('instances');
    const db_history = DB.get('history');

    const deadDate = new Date(new Date().getTime() - (7 * 24 * 60 * 60 * 1000));

    console.log('Looking for dead instances. Dead date: ' + deadDate);

    let instances = await db_instances.find({
        "up": false
    });

    for(let instance of instances) {
		let history = await db_history.findOne({
            "name": instance.name,
            "up": true,
            "date": {
                "$gt": deadDate
            }
        });

		if(!history) {
            console.log(instance.name + ' is dead.');

            await db_instances.update({
				_id: instance._id
			}, {
            	$set: {
            		dead: true
				}
			});
		}
	}
}