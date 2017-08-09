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
      simplify = _traffic.simplify;

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
          trafSpeed = _ref.trafSpeed;
      return trafSpeed * getSiteAdRatio(adList, dots, timeStamp, true);
    };
  };

  var getMoneyTodaySum = function getMoneyTodaySum(adList, dots) {
    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var _getTimeStamps = getTimeStamps(),
        timeStartDay = _getTimeStamps.timeStartDay,
        timeNow = _getTimeStamps.timeNow;

    var filteredAdList = filterAdList(adList, timeStartDay, timeNow);
    var converter = convertToMoney(filteredAdList, dots);

    return getDataSum(dots, timeStartDay, timeNow, converter);
  };

  var getMoneyYesterdaySum = function getMoneyYesterdaySum(adList, dots) {
    if (!adList || !adList.length || !dots || !dots.length) return 0;

    var timeStamp = moment().subtract(1, 'day').unix();

    var _getTimeStamps2 = getTimeStamps(timeStamp),
        timeStartDay = _getTimeStamps2.timeStartDay,
        timeEndDay = _getTimeStamps2.timeEndDay;

    var filteredAdList = filterAdList(adList, timeStartDay, timeEndDay);
    var converter = convertToMoney(filteredAdList, dots);

    return getDataSum(dots, timeStartDay, timeEndDay, converter);
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
    var delta = nowSpeed - yesterdaySpeed;
    var equallyDelta = Math.max(5, Math.max(nowSpeed, yesterdaySpeed) * 0.05);

    if (Math.abs(delta) <= equallyDelta) return 0;
    if (delta > 0) return 1;
    return -1;
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
    var desiredTs = (desiredToTs + desiredFromTs) / 2;
    var deltaMoney = restMoney;

    do {
      var desiredMoney = getDataSum(dots, fakePeriodStart, desiredTs) * moneyRatio;
      deltaMoney = restMoney - desiredMoney;

      if (deltaMoney >= 0) desiredFromTs = desiredTs;
      if (deltaMoney <= 0) desiredToTs = desiredTs;
      desiredTs = (desiredToTs + desiredFromTs) / 2;
    } while (Math.abs(desiredToTs - desiredFromTs) > 5);

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

var last = function last(arr) {
  return arr[arr.length - 1];
};
