// Generated by CoffeeScript 1.8.0
(function() {
  var __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

  angular.module('ngSpinclient', ['uuid4', 'ngMaterial']).factory('spinclient', function(uuid4, $q, $rootScope) {
    var service;
    service = {
      subscribers: [],
      objsubscribers: [],
      objectsSubscribedTo: [],
      outstandingMessages: [],
      modelcache: [],
      rightscache: [],
      io: null,
      sessionId: null,
      objects: [],
      failureMessage: void 0,
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
                    service.failuremessage = reply.info;
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
              var k, lsubs, v, _results;
              console.log('-- registerObjectSubscriber getting obj update callback for ' + detail.id);
              lsubs = service.objectsSubscribedTo[detail.id];
              _results = [];
              for (k in lsubs) {
                v = lsubs[k];
                if (v.cb) {
                  console.log('--*****--*****-- calling back object update to local sid --****--*****-- ' + k);
                  _results.push(v.cb(updatedobj));
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
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
          var count, k, localsubs, v, _i, _len;
          localsubs = service.objectsSubscribedTo[o.id] || [];
          if (localsubs[sid]) {
            console.log('deregistering local updates for object ' + o.id);
            delete localsubs[sid];
            count = 0;
            for (v = _i = 0, _len = localsubs.length; _i < _len; v = ++_i) {
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
      getRightsFor: function(type) {
        var d;
        d = $q.defer();
        if (service.rightscache[type]) {
          d.resolve(service.rightscache[type]);
        } else {
          service.emitMessage({
            target: 'getAccessTypesFor',
            modelname: type
          }).then(function(rights) {
            service.rightscache[type] = rights;
            return d.resolve(rights);
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
        var k, o, prop, subscribers, v, val, _results;
        subscribers = service.objsubscribers[obj.id] || [];
        _results = [];
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
          _results.push(v(obj));
        }
        return _results;
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
            var k, v, _results;
            $scope.targets = [];
            _results = [];
            for (k in _targets) {
              v = _targets[k];
              _results.push($scope.targets.push({
                name: k,
                argnames: v,
                args: v
              }));
            }
            return _results;
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
    'spinclient', '$mdDialog', function(client, $mdDialog) {
      return {
        restrict: 'AE',
        replace: true,
        template: '<div> <md-subheader class="md-no-sticky" style="background-color:#ddd"> <md-icon md-svg-src="assets/images/ic_folder_shared_24px.svg" ></md-icon> {{model.type}} {{objects[model.id].name}}</md-subheader> <md-list > <md-list-item ng-repeat="prop in listprops" layout-fill> <md-input-container layout="row" layout-padding style="min-height:20px"> <label> {{prop.name}} </label> <span flex ng-if="prop.type && prop.value && !prop.hashtable && !prop.array"> <md-button ng-click="enterDirectReference(prop)">{{prop.name}}</md-button> > </span> <input ng-if="!prop.array && !prop.type && isEditable(prop.name) && prop.name != \'id\'" type="text" ng-model="model[prop.name]" ng-change="onChange(model, prop.name)"> <input ng-if="!prop.array && !prop.type && !isEditable(prop.name) || prop.name == \'id\'" type="text" ng-model="model[prop.name]" disabled="true"> <div ng-if="accessrights[prop.type].create && (prop.array || prop.hashtable)"><md-button class="md-raised" ng-click="addModel(prop.type, prop.name)">New {{prop.type}}</md-button></div> <div ng-if="accessrights[model.type].write && (prop.array || prop.hashtable)"><md-button class="md-raised" ng-click="selectModel(prop.type, prop.name)">Add {{prop.type}}</md-button></div> <spinlist ng-if="isEditable(prop.name) && prop.array" flex  listmodel="prop.type" edit="edit" list="model[prop.name]" onselect="onselect" ondelete="ondelete"></spinlist> <spinlist ng-if="!isEditable(prop.name) && prop.array" flex  listmodel="prop.type" list="model[prop.name]" onselect="onselect"></spinlist> <spinhash ng-if="prop.hashtable" flex  listmodel="prop.type" list="prop.value" onselect="onselect"></spinhash> </md-input-container> </md-list-item> </md-list> </div>',
        scope: {
          model: '=model',
          edit: '=?edit',
          onselect: '&',
          hideproperties: '=?hideproperties'
        },
        link: function(scope) {
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
          $scope.accessrights = [];
          $scope.onSubscribedObject = function(o) {
            var k, v, _results;
            console.log('==== spinmodel onSubscribedModel called for ' + o.id + ' updating model..');
            _results = [];
            for (k in o) {
              v = o[k];
              _results.push($scope.model[k] = o[k]);
            }
            return _results;
          };
          $scope.isEditable = (function(_this) {
            return function(propname) {
              var rv;
              rv = $scope.edit;
              if (__indexOf.call($scope.nonEditable, propname) >= 0) {
                rv = false;
              }
              return rv;
            };
          })(this);
          $scope.$watch('model', function(newval, oldval) {
            console.log('spinmodel watch fired for ' + newval);
            if ($scope.model) {
              client.getRightsFor($scope.model.type).then(function(rights) {
                return $scope.accessrights[$scope.model.type] = rights;
              });
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
            return function(model) {
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
              var i, list, mid, propname, _i, _len;
              propname = null;
              md.forEach(function(m) {
                if (m.type === item.type) {
                  return propname = m.name;
                }
              });
              list = $scope.model[propname];
              for (i = _i = 0, _len = list.length; _i < _len; i = ++_i) {
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
                    id: item.id,
                    type: item.type
                  }
                }).then((function(_this) {
                  return function(o) {
                    return console.log('deleted ' + o.type + ' on server');
                  };
                })(this));
              }, failure);
            });
          };
          $scope.updateModel = function() {
            var k, v, _ref, _results;
            _ref = $scope.model;
            _results = [];
            for (k in _ref) {
              v = _ref[k];
              _results.push($scope.listprops.forEach(function(lp) {
                console.log('model.updateModel run for ' + lp);
                if (lp.type) {
                  client.getRightsFor(lp.type).then(function(rights) {
                    return $scope.accessrights[lp.type] = rights;
                  });
                }
                if (lp.name === k) {
                  return lp.value = v;
                }
              }));
            }
            return _results;
          };
          $scope.renderModel = (function(_this) {
            return function() {
              $scope.listprops = [];
              return client.getModelFor($scope.model.type).then(function(md) {
                var foo, i, modeldef, notshow, prop, _i, _len, _ref, _results;
                modeldef = {};
                md.forEach(function(modelprop) {
                  return modeldef[modelprop.name] = modelprop;
                });
                if ($scope.model) {
                  $scope.listprops.push({
                    name: 'id',
                    value: $scope.model.id
                  });
                  _results = [];
                  for (i = _i = 0, _len = md.length; _i < _len; i = ++_i) {
                    prop = md[i];
                    if (prop.type) {
                      client.getRightsFor(prop.type).then(function(rights) {
                        return $scope.accessrights[prop.type] = rights;
                      });
                    }
                    notshow = (_ref = prop.name, __indexOf.call($scope.hideproperties, _ref) >= 0);
                    if (prop.name !== 'id' && !notshow && prop.name !== $scope.activeField && $scope.model[prop.name]) {
                      foo = {
                        name: prop.name,
                        value: $scope.model[prop.name] || "",
                        type: modeldef[prop.name].type,
                        array: modeldef[prop.name].array,
                        hashtable: modeldef[prop.name].hashtable
                      };
                      _results.push($scope.listprops.push(foo));
                    } else {
                      _results.push(void 0);
                    }
                  }
                  return _results;
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
          $scope.selectModel = function(type, propname) {
            return client.emitMessage({
              target: '_list' + type + 's'
            }).then(function(objlist) {
              return $mdDialog.show({
                controller: function(scope) {
                  var list;
                  console.log('++++++++++++++ selectModel controller type=' + type + ', propname=' + propname + ' objlist is...');
                  console.dir(objlist);
                  list = [];
                  objlist.forEach(function(obj) {
                    return list.push(obj.id);
                  });
                  scope.list = list;
                  scope.type = type;
                  console.log('list is');
                  console.dir(list);
                  return scope.onselect = function(model) {
                    console.log('* selectMode onselect callback');
                    console.dir(model);
                    $scope.model[propname].push(model.id);
                    client.emitMessage({
                      target: 'updateObject',
                      obj: $scope.model
                    }).then(success, failure);
                    return $mdDialog.hide();
                  };
                },
                template: '<md-dialog aria-label="selectdialog"><md-content><spinlist listmodel="type" list="list" onselect="onselect"></spinlist></md-content></md-dialog>'
              });
            });
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
        replace: false,
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
                console.log('************************************************* creating new breadcrumbs...');
                $scope.breadcrumbs = [$scope.model];
              }
              return $scope.selectedmodel = $scope.model;
            }
          });
          $scope.crumbClicked = function(model) {
            var crumb, i, idx, _i, _len, _ref;
            $scope.selectedmodel = model;
            idx = -1;
            _ref = $scope.breadcrumbs;
            for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
              crumb = _ref[i];
              console.log('--- ' + ' crumb ' + crumb.name + ', id ' + crumb.id);
              if (crumb.id === model.id) {
                idx = i;
              }
            }
            idx++;
            if (idx > -1 && $scope.breadcrumbs.length > idx) {
              return $scope.breadcrumbs = $scope.breadcrumbs.slice(0, idx);
            }
          };
          $scope.onselect = function(model, replace) {
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
        replace: false,
        template: '<div > <md-subheader class="md-no-sticky" style="background-color:#ddd"> <md-icon md-svg-src="assets/images/ic_apps_24px.svg" ></md-icon> List of {{listmodel}}s</md-subheader> <div ng-if="list.length>0" layout="row" style="height:55px" style="background-color:#e87d0d"> <strong flex>Search:</strong> <md-input-container flex layout-align="left" style="min-height:20px"> <md-select aria-label="search property" ng-model="qproperty" placeholder="name" ng-change="onsearchchange(qproperty)" style="padding:0px"> <md-option ng-value="opt" ng-repeat="opt in objectmodel">{{ opt.name }}</md-option> </md-select> </md-input-container> <md-input-container flex layout-align="center" style="min-height:20px"> <input aria-label="search value" type="text" ng-model="qvalue" required ng-change="onvaluechanged(qvalue)"> </md-input-container> </div> <md-list > <md-list-item ng-repeat="item in expandedlist" layout="row"> <md-button ng-if="edit" aria-label="delete" class="md-icon-button" ng-click="deleteItem(item)"> <md-icon md-svg-src="assets/images/ic_delete_24px.svg"></md-icon> </md-button> <md-button  ng-click="selectItem(item)"> <img ng-if="item.value" ng-src="item.value"> {{ objects[item.id].name }} </md-button> </md-list-item> </md-list> </div>',
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
          $scope.expandedlist = [];
          $scope.objects = client.objects;
          $scope.objectmodel = void 0;
          $scope.qvalue = '';
          $scope.qproperty = 'name';
          client.getModelFor($scope.listmodel).then(function(md) {
            return $scope.objectmodel = md;
          });
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
          $scope.onsearchchange = function(v) {
            return console.log('onsearchchange called. v = ' + v + ' qprop = ' + $scope.qproperty + ', qval = ' + $scope.qvalue);
          };
          $scope.onvaluechanged = function(v) {
            var q;
            console.log('onvaluechange called. v = ' + v + ' qprop = ' + $scope.qproperty + ', qval = ' + $scope.qvalue);
            if ($scope.qvalue) {
              q = {
                property: $scope.qproperty,
                value: $scope.qvalue,
                wildcard: true
              };
              console.log('---- query sent to server is..');
              console.dir(q);
              return client.emitMessage({
                target: '_list' + $scope.listmodel + 's',
                query: q
              }).then(function(newlist) {
                console.log('search got back list of ' + newlist.length + ' items');
                $scope.list = [];
                newlist.forEach(function(item) {
                  return $scope.list.push(item.id);
                });
                return $scope.renderList();
              });
            } else {
              return client.emitMessage({
                target: '_list' + $scope.listmodel + 's'
              }).then(function(newlist2) {
                $scope.list = [];
                newlist2.forEach(function(item) {
                  return $scope.list.push(item.id);
                });
                return $scope.renderList();
              });
            }
          };
          $scope.selectItem = (function(_this) {
            return function(item) {
              if ($scope.onselect) {
                return $scope.onselect(item, $scope.replace);
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
            var modelid, _i, _len, _ref, _results;
            $scope.expandedlist = [];
            if ($scope.list) {
              _ref = $scope.list;
              _results = [];
              for (_i = 0, _len = _ref.length; _i < _len; _i++) {
                modelid = _ref[_i];
                console.log('**spinlist expanding list reference for model id ' + modelid + ' of type ' + $scope.listmodel);
                _results.push(client.emitMessage({
                  target: '_get' + $scope.listmodel,
                  obj: {
                    id: modelid,
                    type: $scope.listmodel
                  }
                }).then(function(o) {
                  var i, modid, _j, _len1, _ref1, _results1;
                  console.log('spinlist _get got back object ' + o);
                  console.dir(o);
                  client.objects[o.id] = o;
                  _ref1 = $scope.list;
                  _results1 = [];
                  for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
                    modid = _ref1[i];
                    if (modid === o.id) {
                      console.log('-- exchanging list id with actual list model from server for ' + o.name);
                      _results1.push($scope.expandedlist[i] = o);
                    } else {
                      _results1.push(void 0);
                    }
                  }
                  return _results1;
                }, failure));
              }
              return _results;
            }
          };
          $scope.onSubscribedObject = function(o) {
            var added, i, k, mod, model, v, _i, _len, _ref;
            console.log('onSubscribedObject called ++++++++++++++++++++++++');
            console.dir(o);
            added = false;
            _ref = $scope.list;
            for (i = _i = 0, _len = _ref.length; _i < _len; i = ++_i) {
              model = _ref[i];
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
        replace: false,
        template: '<div> <md-subheader class="md-no-sticky" style="background-color:#ddd"> <md-icon md-svg-src="assets/images/ic_apps_24px.svg" ></md-icon> Hash of {{listmodel}}s</md-subheader> <md-list> <md-list-item ng-repeat="item in expandedlist" layout="row"> <md-button ng-if="!edit" aria-label="delete" class="md-icon-button" ng-click="deleteItem(item)"> <md-icon md-svg-src="bower_components/material-design-icons/action/svg/production/ic_delete_24px.svg"></md-icon> </md-button> <md-button  ng-click="selectItem(item)">{{ objects[item.id].name }}</md-button> </md-list> </div>',
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
          var failure, mid, _i, _len, _ref;
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
          _ref = $scope.list;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            mid = _ref[_i];
            client.emitMessage({
              target: '_get' + $scope.listmodel,
              obj: {
                id: mid,
                type: $scope.listmodel
              }
            }).then(function(o) {
              var i, modid, _j, _len1, _ref1, _results;
              _ref1 = $scope.list;
              _results = [];
              for (i = _j = 0, _len1 = _ref1.length; _j < _len1; i = ++_j) {
                modid = _ref1[i];
                if (modid === o.id) {
                  console.log('adding hashtable element ' + o.name);
                  _results.push($scope.expandedlist[i] = o);
                } else {
                  _results.push(void 0);
                }
              }
              return _results;
            }, failure);
          }
          return $scope.selectItem = (function(_this) {
            return function(item) {
              if ($scope.onselect) {
                return $scope.onselect(item, $scope.replace);
              }
            };
          })(this);
        }
      };
    }
  ]);

}).call(this);

//# sourceMappingURL=spinclient.js.map
