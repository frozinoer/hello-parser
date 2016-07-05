var cheerio = require('cheerio');
var request = require('then-request');
var jsonfile = require('jsonfile');
var csvWriter = require('csv-write-stream');
var fs = require('fs');
var http = require('http');
var https = require('https');
var request = require('request');
var url = require('url');

var urls = [
	'https://www.hellobank.be/faq/faq-detail/?category=what-is-hello-bank',
	'https://www.hellobank.be/faq/faq-detail/?category=already-bnp-paribas-fortis-client-',
	'https://www.hellobank.be/faq/faq-detail/?category=app-hello-bank',
	'https://www.hellobank.be/faq/faq-detail/?category=become-a-customer',
	'https://www.hellobank.be/faq/faq-detail/?category=product-services',
	'https://www.hellobank.be/faq/faq-detail/?category=support-and-help'
]

var items = {};
var parsed = 0;

var responseCount = 0;
var responseMin = 100000;
var responseMax = 0;
var responseSum = 0;
var responseCountAboveThreshold = 0;
var responseThreshold = 280;

var deanonimizedUserSays = {};

processHelloPages();


function processHelloPages() {


	for (var i = 0; i < urls.length; ++i) {

		console.log("Parsing de la page " + urls[i]);

		request({
		    url: urls[i],
		    method: "GET"
		}, function(err, response, body){		

		    if (response.statusCode == 200) {
		    	console.log("code 200");
				$ = cheerio.load(body);
				var categoryTitle = $("header h1").text();
				var pageId = $("form").attr("action").substr('./?category='.length);
		    	var subCategories = [];
				$('.title-content h2').each(function(i, elem) {
					var subCategoryTitle = $(this).text();
					console.log("category : " + categoryTitle);				
					console.log("subCategory : " + subCategoryTitle);
					var subCategoryQuestions = [];

					console.log("nombre de openFaq : " + $(this).parents(".title-content").next().find('li').length + "\n");

					$(this).parents(".title-content").next().find('li').each(function(i, elem) {
						var req = $(this).find("a.openFaq").text();
						var rawResponse = $(this).find("div.well").text();

						var questionId = $(this).find("div.collapse").attr("id");
						var id = anonymize(pageId) + "-" + questionId;

						var response = anonymize(transformResponse(rawResponse));

						var links = [];
						$(this).find("div.well a").each(function(i, elem) {
							var href = $(this).attr("href");
							var text = $(this).text();

							links[links.length] = {
								href: anonymize(href),
								text: anonymize(text)
							}
						});

						++responseCount;
						responseSum += response.length;

						if (response.length < responseMin) {
							responseMin = response.length;
						}

						if (response.length > responseMax) {
							responseMax = response.length;
						}

						if (response.length > responseThreshold) {
							++responseCountAboveThreshold;
						}

						var item = {
							categoryTitle: anonymize(categoryTitle),
							request: anonymize(transformResponse(req)),
							responses: [response],
							links: links
						}
						if (subCategoryTitle !== categoryTitle) {
							item.subCategoryTitle = anonymize(subCategoryTitle);
						}
						items[id] = item;
					});
				});
				console.log("nombre d'url parsees : " + (parsed + 1));
				if (++parsed == urls.length) {
					var file = './leeched.json'
					 
					jsonfile.writeFile(file, items, {spaces: 2}, function (err) {
					  console.error(err)
					})


					var detectedUserSays = 0;
					var keys = Object.keys(items);

					var writer = csvWriter(
						{
						  separator: ',',
						  newline: '\n',
						  headers: ["Key", "SubCategory", "FAQ Question", "Previous alternative User Says", "New User Says", "FAQ Response"],
						  sendHeaders: true
						}
					)
					writer.pipe(fs.createWriteStream('./out.csv'))

					

					for (var key in items) {
						var item = items[key];
						var response = item.responses[0].replace(/\n/g, " ");;

						var userSaysText = "";
						var newUserSayFound = false;

						if (!deanonimizedUserSays[key]) {

//							console.log("pas de userSays trouve pour " + key + ":(");
						} else {
						
							for (var i = 0; i < deanonimizedUserSays[key].length; ++i) {
								var userSay = deanonimizedUserSays[key][i].trim();
								if (userSay === item.request) {
									detectedUserSays++;
								} else {
									userSaysText += userSay + " --- ";
									newUserSayFound = true;
								}
							}
						}
						if (newUserSayFound) {
							userSaysText = userSaysText.substring(0, userSaysText.length - 5);
//							console.log("suppression de la fin");
						}
						// retirer les 4 derniers caracteres
						writer.write([key, item.subCategoryTitle, item.request, userSaysText, "", response])					
					}
					writer.end();
					console.log("UserSay detectes comme question initiale : " + detectedUserSays);


					console.log("taille moyenne de reponse : " + (responseSum / responseCount));
					console.log("taille min de reponse : " + responseMin);
					console.log("taille max de reponse : " + responseMax);
					console.log("nombre de responses : " + responseCount);
					console.log("nombre de responses > " + responseThreshold + " : " + responseCountAboveThreshold);				
				}

			}
		//		console.log(body);
			if (response.statusCode === 400) {
		  		console.log("400");			
			} else if (response.statusCode === 409) {
		  		console.log("409");			
			}  else if (response.statusCode !== 400 && response.statusCode !== 409 && response.statusCode !== 200) {
				console.log("code error : " + response.statusCode); 
			}			

	    });
	}
}

function anonymize(text) {
    var newText = text;
/*    newText = newText.replace(/hellobank.be/g, "botbank.distributionlab.com");
    newText = newText.replace(/hellobank.com/g, "botbank.com");    
    newText = newText.replace(/easytransfer.be/g, "mobilepayments.botbank.distributionlab.com");
    newText = newText.replace(/epargnezetcueillez.be/g, "couponing.botbank.distributionlab.com");
    newText = newText.replace(/BNP Paribas Fortis/g, "Bank of the Test");
    newText = newText.replace(/-bnp-paribas-fortis-/g, "-bank-of-the-test-");
    newText = newText.replace(/-hello-/g, "-bot-");
    newText = newText.replace(/hello-bank/g, "bot-bank");
    newText = newText.replace(/say-hello/g, "say-bot");    
    newText = newText.replace(/hellobank/g, "botbank");
    newText = newText.replace(/bnpp/g, "bb");                    
    newText = newText.replace(/BNP Paribas group/g, "Botbank group");
    newText = newText.replace(/bnp-paribas/g, "botbank-group");        
    newText = newText.replace(/Belgium/g, "Botland");
    newText = newText.replace(/Belgian/g, "Botlander");        
    newText = newText.replace(/Brussels/g, "Botville");
    newText = newText.replace(/Hello/g, "Bot");
    newText = newText.replace(/epargnezetcuillez.be/g, "couponing.botbank.distributionlab.com");
    newText = newText.replace(/cardifclaims@cap-protection.be/g, "claims.botbank.distributionlab.com");
    newText = newText.replace(/administration.be/g, "administration");
    newText = newText.replace(/02 433 41 45/g, "01 23 45 67 8");
    newText = newText.replace(/\+ 32 \(0\) 70 344 344/g, "01 23 45 67 8");
    newText = newText.replace(/\+32 \(0\)2 433 41 45/g, "01 23 45 67 8");
    newText = newText.replace(/\+32 \(0\)70 344 344/g, "01 23 45 67 8");
    newText = newText.replace(/\+32 \(0\)2 261 11 11/g, "01 23 45 67 8");
    newText = newText.replace(/Boulevard de Berlaimont/g, "Botville Boulevard");
    newText = newText.replace(/Index 1QA6X Montagne du Parc 3/g, "Botville Boulevard");
    newText = newText.replace(/rue du Congrès 12-14/g, "Botville Boulevard 16");
    newText = newText.replace(/25879A/g, "00000A");        
	newText = newText.replace(/Zoomit/g, "PayYourBill/Botbank");
	newText = newText.replace(/Easy Transfer/gi, "Botbank Mobile Payments");
	newText = newText.replace(/Easy transfer/gi, "Botbank mobile payments");
	newText = newText.replace(/easy-transfer/gi, "botbank-mobile-payments");			
	newText = newText.replace(/Épargnez et Cueillez\/Spaar&Pluk/g, "Couponing Botbank");*/
	newText = newText.replace(/\(/g, "-");
	newText = newText.replace(/\)/g, "-");		
	newText = newText.replace(/’/g, "'");
	return newText;
}



function deanonomizeAction(text) {
    var newText = text;
    newText = newText.replace(/-bank-of-the-test-/g, "-bnp-paribas-fortis-");
    newText = newText.replace(/-bot-/g, "-hello-");
    newText = newText.replace(/bot-bank/g, "hello-bank");
    newText = newText.replace(/say-bot/g, "say-hello");
	return newText;    

}

function deanonymizeUserSay(text) {
    var newText = text;
    newText = newText.replace(/\s/g, " ");        
    newText = newText.replace(/botbank.distributionlab.com/g, "hellobank.be");
    newText = newText.replace(/botbank.com/g, "hellobank.com");    
    newText = newText.replace(/mobilepayments.botbank.distributionlab.com/g, "easytransfer.be");
    newText = newText.replace(/couponing.botbank.distributionlab.com/g, "epargnezetcueillez.be");
    newText = newText.replace(/bank of the test/gi, "BNP Paribas Fortis");
    newText = newText.replace(/botbank/g, "hellobank");
    newText = newText.replace(/bot 4 you/g, "Hello4You");
    newText = newText.replace(/bot4You/gi, "Hello4You");    
    newText = newText.replace(/Botbank group/g, "BNP Paribas group");
    newText = newText.replace(/botbank-group/g, "bnp-paribas");        
    newText = newText.replace(/Botland/g, "Belgium");
    newText = newText.replace(/Botbank/g, "Belgium");
    newText = newText.replace(/Banktest/gi, "BNP Paribas Fortis");        
    newText = newText.replace(/Botlander/g, "Belgian");        
    newText = newText.replace(/Botville/g, "Brussels");
	newText = newText.replace(/PayYourBill\/Botbank/g, "Zoomit");
	newText = newText.replace(/Botbank Mobile Payments/gi, "Easy Transfer");
	newText = newText.replace(/Botbank mobile payments/gi, "Easy transfer");
	newText = newText.replace(/botbank-mobile-payments/gi, "easy-transfer");			
    newText = newText.replace(/ bot /gi, " Hello ");
    newText = newText.replace(/ bot?/gi, " Hello?");    
	newText = newText.replace(/Couponing Botbank/g, "Épargnez et Cueillez/Spaar&Pluk");
	return newText;
}


function transformResponse(res) {
	return res.trim();
}

