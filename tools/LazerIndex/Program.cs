using Realms;
using System.Text.Json;

try
{
    if (args.Length != 1 || !File.Exists(args[0])) throw new Exception("Укажите существующий client.realm");
    // Dynamic mode reads the stored schema. Never migrate, compact or write lazer's database.
    using var realm = Realm.GetInstance(new RealmConfiguration(Path.GetFullPath(args[0])) { IsDynamic = true, IsReadOnly = true });
    var maps = new List<object>();
    var sets = new Dictionary<string, object>();
    foreach (dynamic map in realm.DynamicApi.All("Beatmap"))
    {
        dynamic set = map.BeatmapSet!;
        if (set == null || (bool)set.DeletePending || (long)map.Ruleset.OnlineID != 0) continue;
        string setKey = set.ID.ToString();
        if (!sets.ContainsKey(setKey))
        {
            var files = new List<object>();
            foreach (dynamic file in set.Files)
                files.Add(new { name = (string)file.Filename, sha256 = (string)file.File.Hash });
            sets.Add(setKey, files);
        }
        maps.Add(new { hash = (string)map.MD5Hash, sha256 = (string)map.Hash, setKey });
    }
    Console.Write(JsonSerializer.Serialize(new { maps, sets }));
}
catch (Exception e)
{
    Console.Error.WriteLine("Не удалось прочитать индекс lazer в режиме только чтения: " + e.Message);
    Environment.ExitCode = 1;
}
