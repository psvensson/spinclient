// Generated by CoffeeScript 1.9.1
(function() {
  var indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  angular.module('ngSpinclient', ['uuid4', 'ngMaterial']).factory('spinclient', function(uuid4, $q, $rootScope) {
    var service;
    service = {
      subscribers: [],
      objsubscribers: [],
      objectsSubscribedTo: [],
      outstandingMessages: [],
      modelcache: [],
      io: null,
      sessionId: null,
      objects: [],
      failed: function(msg) {
        return console.log('spinclient message failed!! ' + msg);
      },
      setSessionId: function(id) {
        if (id) {
          console.log('++++++++++++++++++++++++++++++++++++++ spinclient setting session id to ' + id);
          return service.sessionId = id;
        }
      },
      dumpOutstanding: function() {},
      setWebSocketInstance: (function(_this) {
        return function(io) {
          service.io = io;
          return service.io.on('message', function(reply) {
            var detail, i, index, info, message, status, subscribers;
            status = reply.status;
            message = reply.payload;
            info = reply.info;
            service.dumpOutstanding();
            index = -1;
            if (reply.messageId) {
              i = 0;
              while (i < service.outstandingMessages.length) {
                detail = service.outstandingMessages[i];
                if (detail.messageId === reply.messageId) {
                  if (reply.status === 'FAILURE') {
                    console.log('spinclient message FAILURE');
                    console.dir(reply);
                    detail.d.reject(reply);
                    break;
                  } else {
                    detail.d.resolve(message);
                    index = i;
                    break;
                  }
                }
                i++;
              }
              if (index > -1) {
                return service.outstandingMessages.splice(index, 1);
              }
            } else {
              subscribers = service.subscribers[info];
              if (subscribers) {
                return subscribers.forEach(function(listener) {
                  return listener(message);
                });
              } else {
                console.log('no subscribers for message ' + message);
                return console.dir(reply);
              }
            }
          });
        };
      })(this),
      registerListener: function(detail) {
        var subscribers;
        console.log('spinclient::registerListener called for ' + detail.message);
        subscribers = service.subscribers[detail.message] || [];
        subscribers.push(detail.callback);
        return service.subscribers[detail.message] = subscribers;
      },
      registerObjectSubscriber: function(detail) {
        var d, localsubs, sid;
        d = $q.defer();
        sid = uuid4.generate();
        localsubs = service.objectsSubscribedTo[detail.id];
        console.log('registerObjectSubscriber localsubs is');
        console.dir(localsubs);
        if (!localsubs) {
          localsubs = [];
          console.log('no local subs, so get the original server-side subscription for id ' + detail.id);
          service._registerObjectSubscriber({
            id: detail.id,
            type: detail.type,
            cb: function(updatedobj) {
              var k, lsubs, results1, v;
              console.log('-- registerObjectSubscriber getting obj update callback for ' + detail.id);
              lsubs = service.objectsSubscribedTo[detail.id];
              results1 = [];
              for (k in lsubs) {
                v = lsubs[k];
                if (v.cb) {
                  console.log('--*****--*****-- calling back object update to local sid --****--*****-- ' + k);
                  results1.push(v.cb(updatedobj));
                } else {
                  results1.push(void 0);
                }
              }
              return results1;
            }
          }).then(function(remotesid) {
            localsubs['remotesid'] = remotesid;
            localsubs[sid] = detail;
            console.log('-- adding local callback listener to object updates for ' + detail.id + ' local sid = ' + sid + ' remotesid = ' + remotesid);
            service.objectsSubscribedTo[detail.id] = localsubs;
            return d.resolve(sid);
          });
        }
        return d.promise;
      },
      _registerObjectSubscriber: function(detail) {
        var d, subscribers;
        d = $q.defer();
        console.log('message-router registering subscriber for object ' + detail.id + ' type ' + detail.type);
        subscribers = service.objsubscribers[detail.id] || [];
        service.emitMessage({
          target: 'registerForUpdatesOn',
          obj: {
            id: detail.id,
            type: detail.type
          }
        }).then(function(reply) {
          console.log('server subscription id for id ' + detail.id + ' is ' + reply);
          subscribers[reply] = detail.cb;
          service.objsubscribers[detail.id] = subscribers;
          return d.resolve(reply);
        }, function(reply) {
          return service.failed(reply);
        });
        return d.promise;
      },
      deRegisterObjectSubscriber: (function(_this) {
        return function(sid, o) {
          var count, j, k, len, localsubs, v;
          localsubs = service.objectsSubscribedTo[o.id] || [];
          if (localsubs[sid]) {
            console.log('deregistering local updates for object ' + o.id);
            delete localsubs[sid];
            count = 0;
            for (v = j = 0, len = localsubs.length; j < len; v = ++j) {
              k = localsubs[v];
              count++;
            }
            if (count === 1) {
              return service._deRegisterObjectSubscriber('remotesid', o);
            }
          }
        };
      })(this),
      _deRegisterObjectSubscriber: (function(_this) {
        return function(sid, o) {
          var subscribers;
          subscribers = service.objsubscribers[o.id] || [];
          if (subscribers && subscribers[sid]) {
            delete subscribers[sid];
            service.objsubscribers[o.id] = subscribers;
            return service.emitMessage({
              target: 'deRegisterForUpdatesOn',
              id: o.id,
              type: o.type,
              listenerid: sid
            }).then(function(reply) {
              return console.log('deregistering server updates for object ' + o.id);
            });
          }
        };
      })(this),
      emitMessage: function(detail) {
        var d;
        d = $q.defer();
        detail.messageId = uuid4.generate();
        detail.sessionId = service.sessionId;
        detail.d = d;
        service.outstandingMessages.push(detail);
        service.io.emit('message', JSON.stringify(detail));
        return d.promise;
      },
      getModelFor: function(type) {
        var d;
        d = $q.defer();
        if (service.modelcache[type]) {
          d.resolve(service.modelcache[type]);
        } else {
          service.emitMessage({
            target: 'getModelFor',
            modelname: type
          }).then(function(model) {
            service.modelcache[type] = model;
            return d.resolve(model);
          });
        }
        return d.promise;
      },
      listTargets: function() {
        var d;
        d = $q.defer();
        service.emitMessage({
          target: 'listcommands'
        }).then(function(targets) {
          return d.resolve(targets);
        });
        return d.promise;
      },
      flattenModel: function(model) {
        var k, rv, v;
        rv = {};
        for (k in model) {
          v = model[k];
          if (angular.isArray(v)) {
            rv[k] = v.map(function(e) {
              return e.id;
            });
          } else {
            rv[k] = v;
          }
        }
        return rv;
      }
    };
    service.subscribers['OBJECT_UPDATE'] = [
      function(obj) {
        var k, o, prop, results1, subscribers, v, val;
        subscribers = service.objsubscribers[obj.id] || [];
        results1 = [];
        for (k in subscribers) {
          v = subscribers[k];
          if (!service.objects[obj.id]) {
            service.objects[obj.id] = obj;
          } else {
            o = service.objects[obj.id];
            for (prop in obj) {
              val = obj[prop];
              o[prop] = val;
            }
          }
          results1.push(v(obj));
        }
        return results1;
      }
    ];
    return service;
  }).directive('alltargets', [
    'spinclient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <h2>Status: {{status}}</h2> Return Type:<md-select ng-model="currentmodeltype" placeholder="Select a return type for calls"> <md-option ng-value="opt" ng-repeat="opt in modeltypes">{{ opt }}</md-option> </md-select> <div layout="row"> <div flex> <div ng-repeat="target in targets"> <button ng-click="callTarget(target)">{{target.name}}</button> - <span ng-if="target.args==\'<none>\'">{{target.args}}</span><span ng-if="target.args!=\'<none>\'"><input type="text" ng-model="target.args"></span> </div> </div> <div flex> <spinlist ng-if="results && results.length > 0" list="results" listmodel="currentmodeltype" edit="\'true\'" onselect="onitemselect" style="height:300px;overflow:auto"></spinlist> <md-divider></md-divider> <div ng-if="itemselected"> <spinwalker model="itemselected" edit="\'true\'"></spinwalker> </div> </div> </div> </div>',
        link: function(scope, elem, attrs) {},
        controller: function($scope) {
          var failure, success;
          $scope.results = [];
          console.log('alltargets controller');
          $scope.onitemselect = (function(_this) {
            return function(item) {
              console.log('alltargets item selected ' + item.name);
              return $scope.itemselected = item;
            };
          })(this);
          client.listTargets().then(function(_targets) {
            var k, results1, v;
            $scope.targets = [];
            results1 = [];
            for (k in _targets) {
              v = _targets[k];
              results1.push($scope.targets.push({
                name: k,
                argnames: v,
                args: v
              }));
            }
            return results1;
          });
          success = function(results) {
            $scope.results = results;
            return console.dir($scope.results);
          };
          failure = function(reply) {
            console.log('failure' + reply);
            return $scope.status = reply.status + ' - ' + reply.info;
          };
          $scope.callTarget = function(t) {
            var callobj, i, values;
            $scope.status = "";
            console.log('calltarget called with ' + t.name);
            callobj = {
              target: t.name
            };
            if (t.argnames !== "<none>") {
              values = t.args.split(',');
              i = 0;
              t.argnames.split(',').forEach(function(arg) {
                return callobj[arg] = values[i++];
              });
            }
            return client.emitMessage(callobj).then(success, failure);
          };
          return client.emitMessage({
            target: 'listTypes'
          }).then(function(types) {
            return $scope.modeltypes = types;
          });
        }
      };
    }
  ]).directive('spinmodel', [
    'spinclient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <md-list > <md-subheader class="md-no-sticky" style="background-color:#ddd"> <md-icon md-svg-src="assets/images/ic_folder_shared_24px.svg" ></md-icon> {{model.type}} {{objects[model.id].name}}</md-subheader> <md-list-item ng-repeat="prop in listprops" > <div class="md-list-item-text" style="line-height:2em;padding-left:5px;" layout="row"> <div flex style="background-color:#eee;margin-bottom:2px"> {{prop.name}} </div> <span flex ng-if="prop.type && prop.value && !prop.hashtable && !prop.array"> <md-button ng-click="enterDirectReference(prop)">{{prop.name}}</md-button> > </span> <div ng-if="!prop.array && !prop.type" flex class="md-secondary"> <span ng-if="isEditable(prop.name) && prop.name != \'id\'"><input type="text" ng-model="model[prop.name]" ng-change="onChange(model, prop.name)"></span> <span ng-if="!isEditable(prop.name) || prop.name == \'id\'"><input type="text" ng-model="model[prop.name]" disabled="true"></span> </div> <div flex ng-if="isEditable(prop.name) && prop.array"> <div><md-button class="md-raised" ng-click="addModel(prop.type, prop.name)">New {{prop.type}}</md-button></div> <spinlist  flex class="md-secondary" listmodel="prop.type" edit="edit" list="model[prop.name]" onselect="onselect" ondelete="ondelete"></spinlist> </div> <span flex ng-if="!isEditable(prop.name) && prop.array"> <spinlist flex class="md-secondary" listmodel="prop.type" list="model[prop.name]" onselect="onselect"></spinlist> </span> <div flex ng-if="prop.hashtable"> <div ng-if="isEditable(prop.name)"><md-button class="md-raised" ng-click="addModel(prop.type, prop.name)">New {{prop.type}}</md-button></div> <spinhash flex class="md-secondary" listmodel="prop.type" list="prop.value" onselect="onselect"></spinhash> </div> </div> </md-list-item> </md-list> </div>',
        scope: {
          model: '=model',
          edit: '=?edit',
          onselect: '&',
          hideproperties: '=?hideproperties'
        },
        link: function(scope, elem, attrs) {
          return scope.onselect = scope.onselect();
        },
        controller: function($scope) {
          var failure, success;
          $scope.hideproperties = $scope.hideproperties || [];
          $scope.isarray = angular.isArray;
          $scope.subscription = void 0;
          $scope.nonEditable = ['createdAt', 'createdBy', 'modifiedAt'];
          $scope.activeField = void 0;
          $scope.objects = client.objects;
          $scope.onSubscribedObject = function(o) {
            var k, results1, v;
            console.log('==== spinmodel onSubscribedModel called for ' + o.id + ' updating model..');
            results1 = [];
            for (k in o) {
              v = o[k];
              results1.push($scope.model[k] = o[k]);
            }
            return results1;
          };
          $scope.isEditable = (function(_this) {
            return function(propname) {
              var rv;
              rv = $scope.edit;
              if (indexOf.call($scope.nonEditable, propname) >= 0) {
                rv = false;
              }
              return rv;
            };
          })(this);
          $scope.$watch('model', function(newval, oldval) {
            console.log('spinmodel watch fired for ' + newval);
            if ($scope.model) {
              if ($scope.listprops && newval.id === oldval.id) {
                $scope.updateModel();
              } else {
                $scope.renderModel();
              }
              if (!$scope.subscription) {
                return client.registerObjectSubscriber({
                  id: $scope.model.id,
                  type: $scope.model.type,
                  cb: $scope.onSubscribedObject
                }).then(function(listenerid) {
                  return $scope.subscription = {
                    sid: listenerid,
                    o: $scope.model
                  };
                });
              }
            }
          });
          success = (function(_this) {
            return function(result) {
              return console.log('success: ' + result);
            };
          })(this);
          failure = (function(_this) {
            return function(err) {
              return console.log('error: ' + err);
            };
          })(this);
          $scope.onChange = (function(_this) {
            return function(model, prop) {
              console.log('spinmodel onChange called for');
              console.dir(model);
              $scope.activeField = model.type;
              return client.emitMessage({
                target: 'updateObject',
                obj: model
              }).then(success, failure);
            };
          })(this);
          $scope.ondelete = function(item) {
            return client.getModelFor($scope.model.type).then(function(md) {
              var i, j, len, list, mid, propname;
              propname = null;
              md.forEach(function(m) {
                if (m.type === item.type) {
                  return propname = m.name;
                }
              });
              list = $scope.model[propname];
              for (i = j = 0, len = list.length; j < len; i = ++j) {
                mid = list[i];
                if (mid === item.id) {
                  list.splice(i, 1);
                }
              }
              console.log('updating parent model to list with spliced list');
              return client.emitMessage({
                target: 'updateObject',
                obj: $scope.model
              }).then(function() {
                return client.emitMessage({
                  target: '_delete' + item.type,
                  obj: {
                    id: m.id,
                    type: item.type
                  }
                }).then((function(_this) {
                  return function(o) {
                    return console.log('deleted ' + item.type + ' on server');
                  };
                })(this));
              }, failure);
            });
          };
          $scope.updateModel = function() {
            var k, ref, results1, v;
            ref = $scope.model;
            results1 = [];
            for (k in ref) {
              v = ref[k];
              results1.push($scope.listprops.forEach(function(lp) {
                if (lp.name === k) {
                  return lp.value = v;
                }
              }));
            }
            return results1;
          };
          $scope.renderModel = (function(_this) {
            return function() {
              $scope.listprops = [];
              return client.getModelFor($scope.model.type).then(function(md) {
                var foo, i, j, len, modeldef, notshow, prop, ref, results1;
                modeldef = {};
                md.forEach(function(modelprop) {
                  return modeldef[modelprop.name] = modelprop;
                });
                if ($scope.model) {
                  $scope.listprops.push({
                    name: 'id',
                    value: $scope.model.id
                  });
                  results1 = [];
                  for (i = j = 0, len = md.length; j < len; i = ++j) {
                    prop = md[i];
                    notshow = (ref = prop.name, indexOf.call($scope.hideproperties, ref) >= 0);
                    if (prop.name !== 'id' && !notshow && prop.name !== $scope.activeField) {
                      foo = {
                        name: prop.name,
                        value: $scope.model[prop.name] || "",
                        type: modeldef[prop.name].type,
                        array: modeldef[prop.name].array,
                        hashtable: modeldef[prop.name].hashtable
                      };
                      results1.push($scope.listprops.push(foo));
                    } else {
                      results1.push(void 0);
                    }
                  }
                  return results1;
                }
              });
            };
          })(this);
          $scope.enterDirectReference = (function(_this) {
            return function(prop) {
              console.log('enterDirectReference called for ');
              console.dir(prop);
              return client.emitMessage({
                target: '_get' + prop.type,
                obj: {
                  id: $scope.model[prop.name],
                  type: prop.type
                }
              }).then(function(o) {
                console.log('enterDirectReference got back ');
                console.dir(o);
                return $scope.onselect(o);
              }, failure);
            };
          })(this);
          $scope.addModel = function(type, propname) {
            console.log('addModel called for type ' + type);
            return client.emitMessage({
              target: '_create' + type,
              obj: {
                name: 'new ' + type,
                type: type
              }
            }).then((function(_this) {
              return function(o) {
                $scope.model[propname].push(o.id);
                console.log('parent model is now');
                console.dir($scope.model);
                return client.emitMessage({
                  target: 'updateObject',
                  obj: $scope.model
                }).then(success, failure);
              };
            })(this), failure);
          };
          return $scope.$on('$destroy', (function(_this) {
            return function() {
              var s;
              s = $scope.subscription;
              console.log('spinmodel captured $destroy event s = ' + s);
              if (s) {
                return client.deRegisterObjectSubscriber(s.sid, s.o);
              }
            };
          })(this));
        }
      };
    }
  ]).directive('spinwalker', [
    'spinclient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <span ng-repeat="crumb in breadcrumbs"> <md-button ng-click="crumbClicked(crumb)">{{crumbPresentation(crumb)}}</md-button> > </span> <md-divider></md-divider> <spinmodel model="selectedmodel" edit="edit" onselect="onselect" hideproperties="hideproperties" style="height:400px;overflow:auto"></spinmodel> </div>',
        scope: {
          model: '=model',
          edit: '=edit',
          hideproperties: '='
        },
        link: function(scope, elem, attrs) {},
        controller: function($scope) {
          $scope.selectedmodel = $scope.model;
          $scope.breadcrumbs = [$scope.model];
          $scope.$watch('model', function(newval, oldval) {
            console.log('spinwalker model = ' + $scope.model);
            if ($scope.model) {
              console.dir($scope.model);
              if (!$scope.breadcrumbs) {
                console.log('************************************************* creating new breadcrumbs..');
                $scope.breadcrumbs = [$scope.model];
              }
              return $scope.selectedmodel = $scope.model;
            }
          });
          $scope.crumbClicked = function(model) {
            var crumb, i, idx, j, len, ref;
            console.log('************************************************* crumbClicked selected model ' + model.is + ' ' + model.type);
            $scope.selectedmodel = model;
            idx = -1;
            ref = $scope.breadcrumbs;
            for (i = j = 0, len = ref.length; j < len; i = ++j) {
              crumb = ref[i];
              if (crumb.id === model.id) {
                idx = i;
              }
            }
            console.log('************************************************* crumbClicked crumbs length = ' + $scope.breadcrumbs.length);
            if (idx > -1 && $scope.breadcrumbs.length > 1) {
              return $scope.breadcrumbs.splice(idx, 1);
            }
          };
          $scope.onselect = function(model, replace) {
            console.log('************************************************* spinwalker onselect for model ' + model.name);
            console.log(model);
            if (replace) {
              $scope.breadcrumbs = [];
            }
            $scope.selectedmodel = model;
            return $scope.breadcrumbs.push(model);
          };
          return $scope.crumbPresentation = (function(_this) {
            return function(crumb) {
              return crumb.name || crumb.type;
            };
          })(this);
        }
      };
    }
  ]).directive('spinlist', [
    'spinclient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <md-list > <md-subheader class="md-no-sticky" style="background-color:#ddd"> <md-icon md-svg-src="assets/images/ic_apps_24px.svg" ></md-icon> List of {{listmodel}}s</md-subheader> <md-list-item ng-repeat="item in expandedlist" > <div class="md-list-item-text" style="line-height:2em;padding-left:5px;" layout="row"> <span flex > <md-button ng-if="edit" aria-label="delete" class="md-icon-button" ng-click="deleteItem(item)"> <md-icon md-svg-src="assets/images/ic_delete_24px.svg"></md-icon> </md-button> <md-button  ng-click="selectItem(item, true)"><img ng-if="item-image" src="item.value"> {{ objects[item.id].name }}</md-button> </span> <!-- <span flex class="md-secondary"> {{item.id}}</span> --> </div> </md-list-item> </md-list> </div>',
        scope: {
          list: '=list',
          listmodel: '=listmodel',
          edit: '=edit',
          onselect: '&',
          ondelete: '&'
        },
        link: function(scope, elem, attrs) {
          scope.onselect = scope.onselect();
          return scope.ondelete = scope.ondelete();
        },
        controller: function($scope) {
          var failure, success;
          console.log('*** spinlist created. list is ' + $scope.list + ' items, type is ' + $scope.listmodel);
          console.dir($scope.list);
          $scope.subscriptions = [];
          $scope.objects = [];
          $scope.expandedlist = [];
          $scope.objects = client.objects;
          success = (function(_this) {
            return function(result) {
              return console.log('success: ' + result);
            };
          })(this);
          failure = (function(_this) {
            return function(err) {
              console.log('error: ' + err);
              return console.dir(err);
            };
          })(this);
          $scope.selectItem = (function(_this) {
            return function(item, replace) {
              if ($scope.onselect) {
                return $scope.onselect(item, replace);
              }
            };
          })(this);
          $scope.deleteItem = function(item) {
            if ($scope.ondelete) {
              return $scope.ondelete(item);
            }
          };
          $scope.$watch('list', function(newval, oldval) {
            return $scope.renderList();
          });
          $scope.renderList = function() {
            var j, len, modelid, ref, results1;
            $scope.expandedlist = [];
            if ($scope.list) {
              ref = $scope.list;
              results1 = [];
              for (j = 0, len = ref.length; j < len; j++) {
                modelid = ref[j];
                console.log('**spinlist expanding list reference for model id ' + modelid + ' of type ' + $scope.listmodel);
                results1.push(client.emitMessage({
                  target: '_get' + $scope.listmodel,
                  obj: {
                    id: modelid,
                    type: $scope.listmodel
                  }
                }).then(function(o) {
                  var i, l, len1, modid, ref1, results2;
                  console.log('spinlist _get got back object ' + o);
                  console.dir(o);
                  client.objects[o.id] = o;
                  ref1 = $scope.list;
                  results2 = [];
                  for (i = l = 0, len1 = ref1.length; l < len1; i = ++l) {
                    modid = ref1[i];
                    if (modid === o.id) {
                      console.log('-- exchanging list id with actual list model from server for ' + o.name);
                      results2.push($scope.expandedlist[i] = o);
                    } else {
                      results2.push(void 0);
                    }
                  }
                  return results2;
                }, failure));
              }
              return results1;
            }
          };
          $scope.onSubscribedObject = function(o) {
            var added, i, j, k, len, mod, model, ref, v;
            console.log('onSubscribedObject called ++++++++++++++++++++++++');
            console.dir(o);
            added = false;
            ref = $scope.list;
            for (i = j = 0, len = ref.length; j < len; i = ++j) {
              model = ref[i];
              if (model.id === o.id) {
                console.log('found match in update for object ' + o.id + ' name ' + o.name);
                mod = $scope.expandedlist[i];
                for (k in o) {
                  v = o[k];
                  added = true;
                  mod[k] = v;
                }
              }
            }
            if (!added) {
              $scope.expandedlist.push(o);
            }
            return $scope.$apply();
          };
          $scope.list.forEach(function(model) {
            if (model.id) {
              return client.registerObjectSubscriber({
                id: model.id,
                type: $scope.listmodel,
                cb: $scope.onSubscribedObject
              }).then(function(listenerid) {
                return $scope.subscriptions.push({
                  sid: listenerid,
                  o: {
                    type: $scope.listmodel,
                    id: model.id
                  }
                });
              });
            }
          });
          return $scope.$on('$destroy', (function(_this) {
            return function() {
              console.log('spinlist captured $destroy event');
              return $scope.subscriptions.forEach(function(s) {
                return client.deRegisterObjectSubscriber(s.sid, s.o);
              });
            };
          })(this));
        }
      };
    }
  ]).directive('spinhash', [
    'spinclient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <md-list> <md-list-item ng-repeat="item in expandedlist" > <div class="md-list-item-text" layout="row"> <md-button ng-if="!edit" aria-label="delete" class="md-icon-button" ng-click="deleteItem(item)"> <md-icon md-svg-src="bower_components/material-design-icons/action/svg/production/ic_delete_24px.svg"></md-icon> </md-button> <md-button  ng-click="selectItem(item)">{{ objects[item.id].name }}</md-button> </div> </md-list> </div>',
        scope: {
          list: '=list',
          listmodel: '=listmodel',
          onselect: '&',
          ondelete: '&'
        },
        link: function(scope, elem, attrs) {
          return scope.onselect = scope.onselect();
        },
        controller: function($scope) {
          var failure, j, len, mid, ref;
          console.log('spinhash list for model ' + $scope.listmodel + ' is');
          console.dir($scope.list);
          $scope.objects = client.objects;
          $scope.expandedlist = [];
          failure = (function(_this) {
            return function(err) {
              console.log('error: ' + err);
              return console.dir(err);
            };
          })(this);
          ref = $scope.list;
          for (j = 0, len = ref.length; j < len; j++) {
            mid = ref[j];
            client.emitMessage({
              target: '_get' + $scope.listmodel,
              obj: {
                id: mid,
                type: $scope.listmodel
              }
            }).then(function(o) {
              var i, l, len1, modid, ref1, results1;
              ref1 = $scope.list;
              results1 = [];
              for (i = l = 0, len1 = ref1.length; l < len1; i = ++l) {
                modid = ref1[i];
                if (modid === o.id) {
                  console.log('adding hashtable element ' + o.name);
                  results1.push($scope.expandedlist[i] = o);
                } else {
                  results1.push(void 0);
                }
              }
              return results1;
            }, failure);
          }
          return $scope.selectItem = (function(_this) {
            return function(item, replace) {
              if ($scope.onselect) {
                return $scope.onselect(item, replace);
              }
            };
          })(this);
        }
      };
    }
  ]);

}).call(this);

//# sourceMappingURL=spinclient.js.map
