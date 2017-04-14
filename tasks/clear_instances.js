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
};