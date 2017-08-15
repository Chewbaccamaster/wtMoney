'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

exports.default = function (moment) {
  var _traffic = (0, _wtTraffic2.default)(moment),
      getTimeStamps = _traffic.getTimeStamps,
      getDataSum = _traffic.getDataSum,
      getTrafficGraphData = _traffic.getTrafficGraphData,
      getTrafficSpeed = _traffic.getTrafficSpeed,
      simplify = _traffic.simplify,
      numberCompare = _traffic.numberCompare;

  var getSiteAdRatio = function getSiteAdRatio(adList, dots, timeStamp) {
    var isConverter = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : false;
    return adList.reduce(function (sumRatio, adPacket) {
      var moneyRatio = adPacket.moneyRatio,
          startDate = adPacket.startDate,
          earned = adPacket.earned,
          earnedTs = adPacket.earnedTs,
          budget = adPacket.budget;

      var isEnded = earnedTs && earned >= budget;
      var endDate = isEnded ? earnedTs : adPacket.endDate;
      var inInterval = isConverter ? timeStamp > startDate && timeStamp <= endDate : timeStamp >= startDate && timeStamp <= endDate;
      var fakePeriodStart = earnedTs || startDate;
      var tsInFakePeriod = !isEnded && timeStamp > fakePeriodStart;

      var isEndedInFakePeriod = false;
      if (inInterval && tsInFakePeriod) {
        var processedMoney = getDataSum(dots, fakePeriodStart, timeStamp) * moneyRatio;
        isEndedInFakePeriod = earned + processedMoney > budget;
      }

      return sumRatio += inInterval && !isEndedInFakePeriod ? moneyRatio : 0;
    }, 0);
  };

  var filterAdList = function filterAdList(adList, fromTs, toTs) {
    return adList.filter(function (adPacket) {
      var startDate = adPacket.startDate,
          endDate = adPacket.endDate;

      var fromTsInInterval = fromTs >= startDate && fromTs <= endDate;
      var toTsInInterval = toTs >= startDate && toTs <= endDate;
      if (fromTsInInterval || toTsInInterval) return adPacket;
    });
  };

  var convertToMoney = function convertToMoney(adList, dots) {
    return function (_ref) {
      var timeStamp = _ref.timeStamp,
          trafSpeed = _ref.trafSpeed,
          dot = _ref.dot,
          dotPeriod = _ref.dotPeriod;

      var sumPeriodMoney = adList.reduce(function (total, adPacket) {
        var startDate = adPacket.startDate,
            earned = adPacket.earned,
            moneyRatio = adPacket.moneyRatio,
            budget = adPacket.budget,
            endDate = adPacket.endDate;

        var earnedTs = adPacket.earnedTs || startDate;
        var adRatio = getSiteAdRatio([adPacket], dots, timeStamp, true);

        if (adRatio === 0) {
          var prevDotAdRatio = getSiteAdRatio([adPacket], dots, dot.ts, true);
          if (prevDotAdRatio > 0) {
            // money between earned dot and previous dot
            var uncountedMoney = earnedTs < dot.ts ? getDataSum(dots, earnedTs, dot.ts) * moneyRatio : 0;
            return total += budget - earned - uncountedMoney;
          }
          if (startDate >= dot.ts && trafSpeed * moneyRatio > budget) {
            // ad between two points
            return total += budget;
          }
        }

        return total += trafSpeed * adRatio * dotPeriod;
      }, 0);

      // return money speed
      return dotPeriod > 0 ? sumPeriodMoney / dotPeriod : 0;
    };
  };

  var getMoneySum = function getMoneySum(adList, dots, fromTs, toTs) {
    var filteredAdList = filterAdList(adList, fromTs, toTs);

    return filteredAdList.reduce(function (sum, adPacket) {
      var startDate = adPacket.startDate,
          endDate = adPacket.endDate,
          earnedTs = adPacket.earnedTs,
          status = adPacket.status;
      // accelerated processing of ads that are placed in the "fromTs - toTs" range

      if (status === AD_ENDED && startDate >= fromTs && earnedTs <= toTs) return sum += adPacket.earned;

      var converter = convertToMoney([adPacket], dots);
      var realToTs = Math.min(toTs, endDate);
      return sum += getDataSum(dots, fromTs, realToTs, converter);
    }, 0);
  };

  var getMoneyTodaySum = function getMoneyTodaySum(adList, dots) {
    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var _getTimeStamps = getTimeStamps(),
        timeStartDay = _getTimeStamps.timeStartDay,
        timeNow = _getTimeStamps.timeNow;

    return getMoneySum(adList, dots, timeStartDay, timeNow);
  };

  var getMoneyYesterdaySum = function getMoneyYesterdaySum(adList, dots) {
    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var timeStamp = moment().subtract(1, 'day').unix();

    var _getTimeStamps2 = getTimeStamps(timeStamp),
        timeStartDay = _getTimeStamps2.timeStartDay,
        timeEndDay = _getTimeStamps2.timeEndDay;

    return getMoneySum(adList, dots, timeStartDay, timeEndDay);
  };

  var getMoneySpeed = function getMoneySpeed(adList, dots) {
    var period = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'today';

    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var timeStamp = period === 'yesterday' ? moment().subtract(1, 'day').unix() : moment().unix();
    return getTrafficSpeed(dots, period).total * getSiteAdRatio(adList, dots, timeStamp);
  };

  var getMoneyGraphData = function getMoneyGraphData(adList, dots) {
    var period = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'today';

    if (!adList || !adList.length || !dots || !dots.length) return [];

    return getTrafficGraphData(dots, period).map(function (dot) {
      return _extends({}, dot, {
        y: Math.round(dot.y * getSiteAdRatio(adList, dots, dot.ts))
      });
    });
  };

  var getMoneyChange = function getMoneyChange(adList, dots) {
    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var nowSpeed = getMoneySpeed(adList, dots, 'today');
    var yesterdaySpeed = getMoneySpeed(adList, dots, 'yesterday');
    return numberCompare(nowSpeed, yesterdaySpeed);
  };

  var getAdBudget = function getAdBudget(adPacket, dots) {
    var timeStamp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (!adPacket || !dots || !dots.length) return 0;

    var timeNow = moment().unix();
    var moneyRatio = adPacket.moneyRatio,
        earned = adPacket.earned,
        budget = adPacket.budget,
        startDate = adPacket.startDate;

    var earnedTs = adPacket.earnedTs || startDate;
    var processedMoney = getDataSum(dots, earnedTs, timeStamp || timeNow) * moneyRatio;
    return Math.min(budget, earned + processedMoney);
  };

  var getFakeMoney = function getFakeMoney(adList, dots) {
    var timeStamp = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

    if (!adList || !adList.length || !dots || !dots.length) return 0;
    timeStamp = timeStamp || moment().unix();

    var lastDotTimeStamp = last(dots.sort(function (a, b) {
      return a.ts - b.ts;
    })).ts;
    var filteredAdList = filterAdList(adList, lastDotTimeStamp, timeStamp);
    var converter = convertToMoney(filteredAdList, dots);

    return getDataSum(dots, lastDotTimeStamp, timeStamp, converter);
  };

  var getAdMoneyTimeEnd = function getAdMoneyTimeEnd(adPacket, dots) {
    var moneyRatio = adPacket.moneyRatio,
        startDate = adPacket.startDate,
        earned = adPacket.earned,
        earnedTs = adPacket.earnedTs,
        budget = adPacket.budget,
        endDate = adPacket.endDate;

    if (earnedTs && earned >= budget) return earnedTs;
    var fakePeriodStart = earnedTs || startDate;

    if (earned + getDataSum(dots, fakePeriodStart, endDate) * moneyRatio <= budget) return endDate;

    var restMoney = budget - earned;
    var desiredFromTs = fakePeriodStart;
    var desiredToTs = endDate;
    var desiredTs = null;
    var deltaMoney = restMoney;
    var isDotNotFound = true;

    do {
      desiredTs = (desiredToTs + desiredFromTs) / 2;
      deltaMoney = restMoney - getDataSum(dots, fakePeriodStart, desiredTs) * moneyRatio;
      isDotNotFound = Math.abs(desiredToTs - desiredFromTs) > 5;

      if (deltaMoney >= 0) desiredFromTs = desiredTs;
      if (deltaMoney <= 0) desiredToTs = desiredTs;
    } while (isDotNotFound);

    return Math.ceil(desiredTs);
  };

  return {
    getMoneyTodaySum: getMoneyTodaySum,
    getMoneyYesterdaySum: getMoneyYesterdaySum,
    getMoneySpeed: getMoneySpeed,
    getMoneyGraphData: getMoneyGraphData,
    getMoneyChange: getMoneyChange,
    getAdBudget: getAdBudget,
    getFakeMoney: getFakeMoney,
    getAdMoneyTimeEnd: getAdMoneyTimeEnd,
    simplify: simplify
  };
};

var _wtTraffic = require('wt-traffic');

var _wtTraffic2 = _interopRequireDefault(_wtTraffic);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var last = function last(array) {
  return array[array.length - 1];
};
var AD_ENDED = 2;
