using RLD.CommonAuthentication.Passport.Models;
using ProtoBuf;

namespace CAPNetClient.Models;

[ProtoContract]
public class AppPassport : AuthenticationPassport
{
    [ProtoMember(6)] public string Email { get; set; } = string.Empty;
}
