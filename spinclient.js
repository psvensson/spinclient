// Generated by CoffeeScript 1.8.0
(function() {
  angular.module('angular-spinclient', ['uuid4', 'ngWebSocket']).factory('ngSpinClient', function(uuid4, $websocket, $q) {
    var service;
    service = {
      subscribers: [],
      objsubscribers: [],
      outstandingMessages: [],
      io: io('ws://localhost:3003'),
      registerListener: function(detail) {
        var subscribers;
        subscribers = service.subscribers[detail.message] || [];
        subscribers.push(detail.callback);
        service.subscribers[detail.message] = subscribers;
      },
      registerObjectSubscriber: function(detail) {
        var subscribers;
        console.log('message-router registering subscriber for object ' + detail.obj.id + ' type ' + detail.obj.type);
        subscribers = service.objsubscribers[detail.obj.id] || [];
        subscribers.push(detail.callback);
        service.objsubscribers[detail.obj.id] = subscribers;
        service.io.emit('message', JSON.stringify({
          target: 'registerForUpdatesOn',
          messageId: uuid4.generate(),
          obj: detail.obj
        }));
      },
      emitMessage: function(detail) {
        var d;
        console.log('emitMessage called');
        console.dir(detail);
        d = $q.defer();
        detail.messageId = uuid4.generate();
        service.outstandingMessages.push(detail);
        service.io.emit('message', JSON.stringify(detail));
        detail.d = d;
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
      }
    };
    service.subscribers['OBJECT_UPDATE'] = [
      function(obj) {
        var subscribers;
        console.log('+++++++++++ obj update message router got obj');
        subscribers = service.objsubscribers[obj.id] || [];
        if (subscribers.length === 0) {
          console.log('* OH NOES! * No subscribers for object update on object ' + obj.id);
          return console.dir(service.objsubscribers);
        } else {
          return subscribers.forEach(function(subscriber) {
            return subscriber(obj);
          });
        }
      }
    ];
    service.io.on('message', function(reply) {
      var detail, i, index, info, message, status, subscribers;
      status = reply.status;
      message = reply.payload;
      info = reply.info;
      console.log('got reply id ' + reply.messageId + ' status ' + status + ', info ' + info + ' data ' + message);
      console.dir(reply);
      index = -1;
      if (reply.messageId) {
        i = 0;
        while (i < service.outstandingMessages.length) {
          detail = service.outstandingMessages[i];
          if (detail.messageId === reply.messageId) {
            if (reply.status === 'FAILURE') {
              detail.d.reject(reply);
            } else {
              detail.d.resolve(message);
              index = i;
              break;
            }
          }
          i++;
        }
        if (index > 0) {
          service.outstandingMessages.splice(index, 1);
        }
      } else {
        subscribers = service.subscribers[info];
        if (subscribers) {
          subscribers.forEach(function(listener) {
            listener(message);
          });
        } else {
          console.log('no subscribers for message ' + message);
          console.dir(reply);
        }
      }
    });
    return service;
  }).directive('alltargets', [
    'ngSpinClient', function(client) {
      return {
        restrict: 'AE',
        replace: true,
        templateUrl: 'alltargets.html',
        link: function(scope, elem, attrs) {},
        controller: function($scope) {
          var failure, success;
          $scope.results = ['<none>'];
          console.log('alltargets controller');
          client.listTargets().then(function(_targets) {
            var k, v, _results;
            $scope.targets = [];
            _results = [];
            for (k in _targets) {
              v = _targets[k];
              _results.push($scope.targets.push({
                name: k,
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
          return $scope.callTarget = function(t) {
            $scope.status = "";
            console.log('calltarget called with ' + t.name);
            return client.emitMessage({
              target: t.name
            }).then(success, failure);
          };
        }
      };
    }
  ]);

}).call(this);

//# sourceMappingURL=spinclient.js.map
