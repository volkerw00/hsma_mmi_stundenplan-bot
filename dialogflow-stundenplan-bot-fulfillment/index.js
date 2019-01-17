// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';
 
const functions = require('firebase-functions');
const {WebhookClient} = require('dialogflow-fulfillment');
const {Card, Suggestion, Image} = require('dialogflow-fulfillment');
const admin = require('firebase-admin');
 
process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();
 
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({ request, response });
  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));


  function readScheduleDayUnknown (agent) {
    const parameters = agent.parameters;
    const entries = db.collection('schedule_entries').where("module","==", parameters.module);
    return entries.get()
        .then(function(querySnapshot) {
            var occurences = [];
            var moduleInformation;
            if(!querySnapshot.empty) {
                querySnapshot.forEach(querySnapshotDocument => occurences.push(querySnapshotDocument.data()));
            } else {
                agent.add("Die Vorlesung findet in diesem Semester nicht statt.");
                return Promise.resolve('Read complete');
            }
            
            moduleInformation = occurences[0];
            var result = moduleInformation.module_full 
                            + ", kurz " + moduleInformation.module 
                            + ", findet am " 
            + occurences.map(occurence => {
                        return occurence.day 
                                    + " von " + occurence.block_start 
                                    + " bis " + occurence.block_end
            }).join(" und am ") + " statt.";
            agent.add(result);
            
            agent.context.set({
              'name':'last-module',
              'lifespan': 3,
              'parameters':{
                'modules': [moduleInformation]
                }
            });
        
            return Promise.resolve('Read complete');
        })
      .catch(() => {
        agent.add('Error reading entry from the Firestore database.');
      });
  }
  
  //TODO: Fall, wenn Vorlesung am Tag nicht statt findet
  function readScheduleDayKnown (agent) {
    const parameters = agent.parameters;
    var day = toDayString(parameters.date);

    const entries = db.collection('schedule_entries').where("module","==", parameters.module).where("day","==",day);
    return entries.get()
        .then(function(querySnapshot) {
            var result = "";
            var moduleInformation;
            if(!querySnapshot.empty) {
                moduleInformation = querySnapshot.docs[0].data();
                result += moduleInformation.module_full 
                            + ", kurz " + moduleInformation.module 
                            + ", findet am " + moduleInformation.day
                            + " von " + moduleInformation.block_start
                            + " bis " + moduleInformation.block_end
                            + " statt.";
                agent.add(result);
                
            } else {
                // sollte nie passieren
                result += "Die Vorlesung findet in diesem Semester nicht statt.";
            }
   
            agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': [moduleInformation]
                    }
            });
                
            return Promise.resolve('Read complete');
        })
      .catch((e) => {
        agent.add('Error reading entry from the Firestore database: '+e);
      });
    }
    
    function readRoomDayKnown (agent) {
        const parameters = agent.parameters;
        var day = toDayString(parameters.date);
        const entries = db.collection('schedule_entries').where("module","==", parameters.module).where("day","==",day);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var moduleInformation;
                if(!querySnapshot.empty) {
                    moduleInformation = querySnapshot.docs[0].data();
                    result += moduleInformation.module_full 
                                + ", kurz " + moduleInformation.module 
                                + ", findet am " + moduleInformation.day
                                + " in Raum " + moduleInformation.location
                                + " statt.";
                    agent.add(result);
                    agent.add(new Image(getBuildMap(moduleInformation.location)));
                    
                } else {
                    // sollte nie passieren
                    agent.add("Die Vorlesung findet an diesem Tag nicht statt.");
            
                }
                
                agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': [moduleInformation]
                    }
                });
                
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
            agent.add('Error reading entry from the Firestore database: '+e);
          });
    }
    
    function readRoomDayUnknown (agent) {
        const parameters = agent.parameters;
        const entries = db.collection('schedule_entries').where("module","==", parameters.module);
        return entries.get()
            .then(querySnapshot => {
                var result = "";
                var modules = [];
                if(!querySnapshot.empty) {
                    const moduleInformation = querySnapshot.docs[0].data();
                    result += moduleInformation.module  + ", findet am ";
                                
                    querySnapshot.forEach(doc => modules.push(doc.data()));
                    
                } else {
                    // sollte nie passieren
                    result += "Die Vorlesung findet in diesem Semester nicht statt.";
                    return Promise.resolve('Read complete');
                }
                
                var uniqueDays = uniq(modules.map(module => module.day))
                
                // build answer
                var times = [];
                uniqueDays.forEach(day => times.push(day));
                result += times.join(" und am ");
                result += " statt. ";
                result += "Für welchen Tag hättest du gerne den Raum?"
                agent.add(result);
                
                // add suggestion chips to answer
                uniqueDays.forEach(day => agent.add(new Suggestion(day)));
                
                // persist modules for followups
                agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': modules
                    }
                });
                
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
              console.log(e);
              agent.add('Error reading entry from the Firestore database: ' + e);
          });
    }
    
    function readRoomDayUnknown_followup_DayKnown(agent) {
        let context = agent.context.get('last-module');
        var day = agent.context.get('raum_wenn_tagunbekannt-followup').parameters['day.original'];
        var modules = context.parameters.modules;
        
        var result = "";
        var locations = [];
        modules.forEach(module => {
            if(module.day === day) {
                result = "Am " + module.day + " findet " + module.module + " in ";
                locations.push(module.location);
            }
        });
        if(locations.length > 0) {
            result += locations.join(" oder in ");
            result += " statt.";    
            agent.add(result);
            agent.add(new Image(getBuildMap(locations[0])));
        } else {
            result += modules[0].module + " findet am " + day + " nicht statt. ";
            var uniqueDays = uniq(modules.map(module => module.day));
            result += "Du kannst es am " + uniqueDays.join(" und am ") + " besuchen. ";
            result += "Für welchen Tag hättest du gerne den Raum?";
            agent.add(result);
            uniqueDays.forEach(day => agent.add(new Suggestion(day)));
            
            agent.context.set({
              'name':'last-module',
              'lifespan': 3,
              'parameters':{
                'modules': modules
                }
            });
        }
    }
    
    function readRoomDayUnknown_followup_Fallback(agent) {
        let context = agent.context.get('last-module');
        
        var result = context.parameters.modules[0].module + " findet am ";
        
        var locPerDay = new Map();
        context.parameters.modules.forEach(module => {
            if(locPerDay.has(module.day)) {
                locPerDay.get(module.day).push(module.location);
            } else {
                locPerDay.set(module.day, [module.location]);
            }
        });
        var parts = [];
        var it = locPerDay.keys();
        let day = it.next();
        while (!day.done) {
            let locs = locPerDay.get(day.value);
            parts.push(day.value + " in " + locs.join(" oder "));
            day = it.next();
        }
        
        result += parts.join(" und am ");
        result += " statt.";
        agent.add(result);
    }
    
    function professorFollowup(agent) {
        let context = agent.context.get('last-module');
        var moduleInfo = context.parameters.modules[0];
        agent.add(moduleInfo.module + " wird von Professor " + moduleInfo.professor_full /*+ " ("  + moduleInfo.professor + ")"*/ + " gehalten.");
        agent.context.delete(context);
    }
    
    function krankmeldung(agent) {
        
        const parameters = agent.parameters;
        var day = toDayString(parameters.date);

        const entries = db.collection('schedule_entries').where("module","==", parameters.module).where("day","==",day);
        return entries.get()
        .then(function(querySnapshot) {
            var result = "";
            var moduleInformation;
            if(!querySnapshot.empty) {
                moduleInformation = querySnapshot.docs[0].data();
                console.log(querySnapshot);
                
                
                var fullname = moduleInformation.professor_full;
                var mail = getProfessorMail(fullname);
                
                
                agent.add("Alles klar. Ich habe deine Krankmeldung für die Vorlesung " + moduleInformation.module + " an " + mail + " verschickt!");
                
            } else {
                // sollte nie passieren
              //  agent.add("Die Vorlesung findet in diesem Semester nicht statt.");
            }
   
            
                
            return Promise.resolve('Read complete');
        })
      .catch((e) => {
        agent.add('Error reading entry from the Firestore database: '+e);
      });
        
    }
    
    function booleanFindetStatt(agent) {
        const parameters = agent.parameters;
        var day = toDayString(parameters.date);
        const entries = db.collection('schedule_entries').where("day","==",day).where("module","==",parameters.module);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var moduleInformation;
                if(!querySnapshot.empty) {
                    moduleInformation = querySnapshot.docs[0].data();
                    result += "Ja, die Vorlesung findet statt und zwar in Raum " +moduleInformation.location;
                    agent.add(result);
                    agent.add(new Image(getBuildMap(moduleInformation.location)));
                    
                } else {
                    // sollte nie passieren - HALT STOP, hier schon 8-)
                    agent.add("Nein, die Vorlesung findet an diesem Tag nicht statt.");
            
                }
                
                agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': [moduleInformation]
                    }
                });
                
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
            agent.add('Error reading entry from the Firestore database: '+e);
          });
    }
    
    function tagBekanntFollowup(agent) {
        /*let context = agent.context.get('last-module');
        var moduleInfo = context.parameters.modules[0];
        agent.parameters.module = moduleInfo.module;
        console.log("context.module"+moduleInfo.module);
        console.log("agent.parameters.module: "+agent.parameters.module);
        readScheduleDayKnown(agent);*/
        const parameters = agent.parameters;    //agent Parameter sind die Daten, welche aktuell abgefragt werden "Wann findet Sie DONNERSTAG statt"
        var day = toDayString(parameters.date);
        console.log("DAY: "+day);
        let context = agent.context.get('last-module'); //Daten aus dem Kontext -> Hier muss sich nur das Modul gemerkt werden
        var moduleInfo = context.parameters.modules[0];
        
        const entries = db.collection('schedule_entries').where("module","==", moduleInfo.module).where("day","==",day);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var moduleInformation;
                if(!querySnapshot.empty) {
                    moduleInformation = querySnapshot.docs[0].data();
                    result += moduleInformation.module_full 
                                + ", kurz " + moduleInformation.module 
                                + ", findet am " + moduleInformation.day
                                + " von " + moduleInformation.block_start
                                + " bis " + moduleInformation.block_end
                                + " statt.";
                    agent.add(result);
                } else {
                    // sollte nie passieren
                    result += "Die Vorlesung findet in diesem Semester nicht statt.";
                }
                agent.context.set({
                      'name':'last-module',
                      'lifespan': 3,
                      'parameters':{
                        'modules': [moduleInformation]
                        }
                });
                return Promise.resolve('Read complete');
            })
        agent.context.delete(context)
    }
    
    
    function tagUnbekanntFollowup(agent) {
        let context = agent.context.get('last-module');
        var moduleInfo = context.parameters.modules[0];
        
        const entries = db.collection('schedule_entries').where("module","==", moduleInfo.module);
        return entries.get()
        .then(function(querySnapshot) {
            var occurences = [];
            var moduleInformation;
            if(!querySnapshot.empty) {
                querySnapshot.forEach(querySnapshotDocument => occurences.push(querySnapshotDocument.data()));
            } else {
                agent.add("Die Vorlesung findet in diesem Semester nicht statt.");
                return Promise.resolve('Read complete');
            }
            
            moduleInformation = occurences[0];
            var result = moduleInformation.module_full 
                            + ", kurz " + moduleInformation.module 
                            + ", findet am " 
            + occurences.map(occurence => {
                        return occurence.day 
                                    + " von " + occurence.block_start 
                                    + " bis " + occurence.block_end
            }).join(" und am ") + " statt.";
            agent.add(result);
            
            agent.context.set({
              'name':'last-module',
              'lifespan': 3,
              'parameters':{
                'modules': [moduleInformation]
                }
            });
        
            return Promise.resolve('Read complete');
        })
        agent.context.delete(context)
    }
    
    function roomDayUnknownFollowup(agent) {
        let context = agent.context.get('last-module');
        var moduleInfo = context.parameters.modules[0];
        
        const entries = db.collection('schedule_entries').where("module","==", moduleInfo.module);
        return entries.get()
            .then(querySnapshot => {
                var result = "";
                var modules = [];
                if(!querySnapshot.empty) {
                    const moduleInformation = querySnapshot.docs[0].data();
                    result += moduleInformation.module  + ", findet am ";
                                
                    querySnapshot.forEach(doc => modules.push(doc.data()));
                    
                } else {
                    // sollte nie passieren
                    result += "Die Vorlesung findet in diesem Semester nicht statt.";
                    return Promise.resolve('Read complete');
                }
                
                var uniqueDays = uniq(modules.map(module => module.day))
                
                // build answer
                var times = [];
                uniqueDays.forEach(day => times.push(day));
                result += times.join(" und am ");
                result += " statt. ";
                result += "Für welchen Tag hättest du gerne den Raum?"
                agent.add(result);
                
                // add suggestion chips to answer
                uniqueDays.forEach(day => agent.add(new Suggestion(day)));
                
                // persist modules for followups
                agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': modules
                    }
                });
                
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
              console.log(e);
              agent.add('Error reading entry from the Firestore database: ' + e);
          });
    }
    
    function roomDayKnownFollowup(agent) {
        const parameters = agent.parameters;
        console.log("parameters.date: "+parameters.date);
        var day = toDayString(parameters.date);
        console.log("DAY: "+day);
        let context = agent.context.get('last-module');
        var moduleInfo = context.parameters.modules[0];
        
        const entries = db.collection('schedule_entries').where("module","==", moduleInfo.module).where("day","==",day);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var moduleInformation;
                if(!querySnapshot.empty) {
                    moduleInformation = querySnapshot.docs[0].data();
                    result += moduleInformation.module_full 
                                + ", kurz " + moduleInformation.module 
                                + ", findet am " + moduleInformation.day
                                + " in Raum " + moduleInformation.location
                                + " statt.";
                    agent.add(result);
                    agent.add(new Image(getBuildMap(moduleInformation.location)));
                } else {
                    // sollte nie passieren
                    agent.add("Die Vorlesung findet an diesem Tag nicht statt.");
                }
                
                agent.context.set({
                  'name':'last-module',
                  'lifespan': 3,
                  'parameters':{
                    'modules': [moduleInformation]
                    }
                });
                
                return Promise.resolve('Read complete');
            })
            agent.context.delete(context)
    }
    
    function uniq(a) {
        var prims = {"boolean":{}, "number":{}, "string":{}}, objs = [];
    
        return a.filter(function(item) {
            var type = typeof item;
            if(type in prims)
                return prims[type].hasOwnProperty(item) ? false : (prims[type][item] = true);
            else
                return objs.indexOf(item) >= 0 ? false : objs.push(item);
        });
    }
    
    function getBuildMap(room) {
        var building = room.charAt(0);
        return "http://lecture.michaelsattel.de/mmi/Campusplan/Campusplan" + building + ".png"
        
    }
    
    function getProfessorMail(fullname) {
        
        fullname = fullname.toLowerCase();
        fullname = fullname.replace("dr. ", "");
        fullname = fullname.replace("dr.", "");
        
        var splitted = fullname.split(" ");
        
        var vorname = splitted[0];
        var nachname = splitted[1];
        
        var mail = vorname.charAt(0) + "." + nachname + "@hs-mannheim.de";
        return mail;
        
    }
    
    function toDayString(date) {
        var day = new Date(date);       
        day = day.getDay();
        switch(day){
            case 0:{
                day = "Sonntag";break;
            }
            case 1:{
                day = "Montag";break;
            }
            case 2:{
                day = "Dienstag";break;
            }
            case 3:{
                day = "Mittwoch";break;
            }
            case 4:{
                day = "Donnerstag";break;
            }
            case 5:{
                day = "Freitag";break;
            }
            case 6:{
                day = "Samstag";break;
            }
        }
        return day;
    }
    
    function readProfessor (agent) {
        const parameters = agent.parameters;
        const entries = db.collection('schedule_entries').where("module","==", parameters.module);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var moduleInformation;
                if(!querySnapshot.empty) {
                    moduleInformation = querySnapshot.docs[0].data();
                    result += "Professor " + moduleInformation.professor_full 
                                /*+" ("  + moduleInformation.professor +") "*/
                                + " hält die Vorlesung " + moduleInformation.module + ".";
                    agent.add(result);
                } else {
                    // sollte nie passieren
                    result += "Vorlesung oder Professor nicht bekannt.";
                }
                
                agent.context.set({
                      'name':'last-module',
                      'lifespan': 3,
                      'parameters':{
                        'modules': [moduleInformation]
                        }
                });
                
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
            agent.add('Error reading entry from the Firestore database: '+e);
          });
    }
    
    function readAllModulesDayKnown(agent) {
        const parameters = agent.parameters;
        var day = toDayString(parameters.date);
        const entries = db.collection('schedule_entries').where("day","==", day);
        return entries.get()
            .then(function(querySnapshot) {
                var result = "";
                var modules = []
                if(!querySnapshot.empty) {
                    querySnapshot.forEach(doc => modules.push(doc.data()));
                    result += "Das sind ganz schön viele Vorlesungen. Soll ich sie dir alle vorlesen?"
                } else {
                    // sollte nie passieren
                    result += "An diesem Tag findet keine Vorlesung statt.";
                }
                
                agent.context.set({
                      'name':'last-module',
                      'lifespan': 2,
                      'parameters':{
                        'modules': modules,
                        'day': day
                        }
                });
                agent.add(result);
                return Promise.resolve('Read complete');
            })
          .catch((e) => {
            agent.add('Error reading entry from the Firestore database: '+e);
          });
    }
    
    function readAllModulesDayKnownFollowup (agent){
        const parameters = agent.parameters;
        let context = agent.context.get('last-module'); //Daten aus dem Kontext -> Hier muss sich nur das Modul gemerkt werden
        var modules = context.parameters.modules;
        var day = context.parameters.day;
        
        var result = "Am " + day + " finden folgende Vorlesungen statt: ";
        result += modules.map(m => m.module).join(", ");
        agent.add(result);
    }
  
    let intentMap = new Map();
    
    intentMap.set('Professor', readProfessor);
    intentMap.set('Zeit_wenn_TagUnbekannt', readScheduleDayUnknown);
    intentMap.set('Zeit_wenn_TagBekannt', readScheduleDayKnown);
    intentMap.set('Raum_wenn_TagBekannt', readRoomDayKnown);
    intentMap.set('Raum_wenn_TagUnbekannt', readRoomDayUnknown);
    intentMap.set('Raum_wenn_TagUnbekannt-followup-TagErmitteln', readRoomDayUnknown_followup_DayKnown);
    intentMap.set('Raum_wenn_TagUnbekannt - fallback', readRoomDayUnknown_followup_Fallback);
    
    intentMap.set('followup-Professor', professorFollowup);
    intentMap.set('followup-Zeit_wenn_TagBekannt', tagBekanntFollowup);
    intentMap.set('followup-Zeit_wenn_TagUnbekannt', tagUnbekanntFollowup);
    intentMap.set('followup-Raum_wenn_TagBekannt', roomDayKnownFollowup);
    intentMap.set('followup-Raum_wenn_TagUnbekannt', roomDayUnknownFollowup);
    
    intentMap.set('booleanfindetStatt', booleanFindetStatt);
    intentMap.set('Vorlesungen_wenn_TagBekannt', readAllModulesDayKnown);
    intentMap.set('followup-Vorlesungen_wenn_TagBekannt - yes', readAllModulesDayKnownFollowup);
    
    intentMap.set('krankmeldung', krankmeldung);

    agent.handleRequest(intentMap);
});
