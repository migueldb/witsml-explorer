using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;

using Microsoft.Extensions.Logging;

using Witsml;
using Witsml.Data;
using Witsml.Extensions;
using Witsml.ServiceReference;

using WitsmlExplorer.Api.Jobs.Common.Interfaces;
using WitsmlExplorer.Api.Query;
using WitsmlExplorer.Api.Services;

namespace WitsmlExplorer.Api.Workers
{
    public static class LogWorkerTools
    {
        public static async Task<WitsmlLog> GetLog(IWitsmlClient client, IObjectReference logReference, ReturnElements optionsInReturnElements)
        {
            WitsmlLogs logQuery = LogQueries.GetWitsmlLogById(logReference.WellUid, logReference.WellboreUid, logReference.Uid);
            WitsmlLogs result = await client.GetFromStoreAsync(logQuery, new OptionsIn(optionsInReturnElements));
            WitsmlLog log = result.Logs.FirstOrDefault();

            // Make sure the index curve is the first element in logCurveInfo
            if (log != null)
            {
                log.LogCurveInfo = GetLogCurveInfoWithIndexCurveFirst(log);
            }

            return log;
        }

        public static async Task<WitsmlLogs> GetLogsByIds(IWitsmlClient client, string wellUid, string wellboreUid, string[] logUids, ReturnElements optionsInReturnElements)
        {
            WitsmlLogs logQuery = LogQueries.GetWitsmlLogsByIds(wellUid, wellboreUid, logUids);
            WitsmlLogs result = await client.GetFromStoreAsync(logQuery, new OptionsIn(optionsInReturnElements));

            // Make sure the index curve is the first element in logCurveInfo
            foreach (var log in result.Logs)
            {
                log.LogCurveInfo = GetLogCurveInfoWithIndexCurveFirst(log);
            }

            return result;
        }

        public static List<WitsmlLogCurveInfo> GetLogCurveInfoWithIndexCurveFirst(WitsmlLog log)
        {
            string indexCurve = log.IndexCurve?.Value;
            if (indexCurve == null || log.LogCurveInfo.FirstOrDefault().Mnemonic == indexCurve) return log.LogCurveInfo;
            return log.LogCurveInfo.OrderBy(lci => lci.Mnemonic == indexCurve ? 0 : 1).ToList();
        }

        public static async Task<WitsmlLogData> GetLogDataForCurve(IWitsmlClient witsmlClient, WitsmlLog log, string mnemonic, ILogger logger)
        {
            await using LogDataReader logDataReader = new(witsmlClient, log, mnemonic.AsItemInList(), logger);
            List<WitsmlData> data = new();
            WitsmlLogData logData = await logDataReader.GetNextBatch();
            var mnemonicList = logData?.MnemonicList;
            var unitList = logData?.UnitList;
            while (logData != null)
            {
                data.AddRange(logData.Data);
                logData = await logDataReader.GetNextBatch();
            }

            return new WitsmlLogData
            {
                MnemonicList = mnemonicList,
                UnitList = unitList,
                Data = data
            };
        }
    }
}
