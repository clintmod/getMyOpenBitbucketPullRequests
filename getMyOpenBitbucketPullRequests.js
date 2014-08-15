var request = require("request");
var fs = require("fs")
var prompt = require("prompt");
var configFileName = "./config.json";

var config = {
	username : null,
	password : null,
	repositories : null,
}

function getUnameAndPass() {
	return config.username + ":" + config.password;
}

function init() {
	loadConfig(configLoaded);
}

function configLoaded() {
	promptForInputIfNeeded(inputLoaded);
}

function loadConfig(callback) {
	fs.readFile(configFileName, {encoding:"UTF-8"}, function(err, obj) {
		if(!err && obj && obj.length > 0) {
			config = JSON.parse(obj);
		}
		if(callback) {
			callback();
		}
	})
}

function inputLoaded() {
	for (var i = 0; i < config.repositories.length; i++) {
		var repo = config.repositories[i];
		getMyOpenPullRequests("https://"+getUnameAndPass()+"@bitbucket.org/api/2.0/repositories/"+repo+"/pullrequests?state=OPEN")
	}
}

function promptForInputIfNeeded(callback) {
	var promptConfig = {properties: {}};
	var shouldShowPasswordPrompt = false;
	var shouldShowPrompt = false;
	var promptCounter = 0;
	//build the prompt config dynamically
	if(!config.username) {
		promptConfig.properties.username = {
			required : true
		}
	}

	if(!config.password) {
		promptConfig.properties.password = {
			hidden: true,
			required : true
		}
		shouldShowPasswordPrompt = true;
	}

	if(!config.repositories) {
		promptConfig.properties.repositories = {
			description:"Enter comma separated list of repositories (e.g. org/repo1,org/repo2)",
			required : true,
			type : "string",
			before: function (value) {
				return value.split(",")
			},
		}
	}

	for (var prop in promptConfig.properties) {
		promptCounter++;
		
	}
	
	if(promptCounter > 0) {
		prompt.start();
		//if we're only showing a password prompt don't prompt to save
		if(!(promptCounter == 1 && shouldShowPasswordPrompt)) {
			//add save prompt
			promptConfig.properties.shouldSaveInfo = {
				description:"Save info? (y/n)",
				pattern: /[y|n]/,
				message: "Enter 'y' for yes or 'n' for no.",
				required : true,
				type : "string",
				before: function (value) {
					return value == "y" ? true : false;
				},
			}
		}

		prompt.get(promptConfig, function (err, result) {
			config.username = config.username || result.username;
			config.password = config.password || result.password;
			config.repositories = config.repositories || result.repositories;
			if(result.shouldSaveInfo) {
				var tmp = config.password;
				delete config.password;
				fs.writeFileSync(configFileName, JSON.stringify(config))
				config.password = tmp;
			}
			if(callback) {
				callback();
			}
		});
	} else if(callback) {
		callback();		
	}
}

function getMyOpenPullRequests(url) {
	request(url
		, function (error, response, body) {
			if(error) {
				console.log(error);
			}
			if(response.statusCode != 200) {
				console.log(response.statusCode)
			}
			var pullrequests = JSON.parse(body)
			for (var i = 0; i < pullrequests.values.length; i++) {
				var value = pullrequests.values[i];

				var pullrequestUrl = value.links.self.href.split("://").join("://"+getUnameAndPass()+"@")
				request(pullrequestUrl
					, function (error, response, body) {
						if(error) {
							console.log(error);
						}
						if(response.statusCode != 200) {
							console.log(response.statusCode)
						}
						var pullrequest = JSON.parse(body);
						//console.log(pullrequest)
						for (var j = 0; j < pullrequest.participants.length; j++) {
							var participant = pullrequest.participants[j];
							if(participant.user.username == config.username && participant.approved == false) {
								console.log(pullrequest.links.html.href)
							}
						}
					}
				)
			}
			if(pullrequests.next) {
				var nextPageUrl = pullrequests.next.split("://").join("://"+getUnameAndPass()+"@");
				getMyOpenPullRequests(nextPageUrl)
			}
		}
	)
}


init();