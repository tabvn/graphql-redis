import _ from 'lodash'

/**
* Permissions = [
{
	value: ['administrator'],
	allow: true,
	type: 'role',
}
{
	value: ['id1', 'id2'],
	allow: false,
	type: 'user'
}
]
**/
export default class Topic{

	constructor(name, userId = null, permissions = []){
		this.name = name;
		this.userId = userId;
		this.permissions = permissions ? permissions: [{

		}];

		this.checkAccess = this.checkAccess.bind(this);
	}

	/**
	* Check user has permission to access the topic
	*/
	checkAccess(user){
		const userId = _.get(user, 'id', null);
		let userRoles = _.get(user, 'roles', []);

		if(user){
			userRoles.push('authenticated');
		}else{
			userRoles.push('everyone');
		}

		let allowAccess = this.permissions.length ? false : true;

		_.each(this.permissions, (perm) => {
			
			const isAllow = _.get(perm, 'allow', false);
			const value = _.get(perm, 'value', []);

			if(_.get(perm, 'type') === 'role'){
				
				// let check by single value if has *
				_.each(value, (v) => {
					if(v === '*'){
						allowAccess = isAllow;
					}else{

						if(_.includes(userRoles, v)){
								allowAccess = isAllow;
						}

					}

				});



			}else{
				_.each(value, (v) => {
					if(v === '*'){
						allowAccess = isAllow;
					}
				});

				if(_.includes(value, userId)){
					allowAccess = isAllow;
				}

			}
		});


		return allowAccess;
		
	}

}