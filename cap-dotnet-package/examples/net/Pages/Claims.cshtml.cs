using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.RazorPages;
using RLD.CommonAuthentication.Passport;

namespace CAPNetClient.Pages;

[Authorize(AuthenticationSchemes = PassportAuthenticationDefaults.AuthenticationScheme)]
public class ClaimsModel : PageModel
{
    public IEnumerable<(string Type, string Value)> Claims { get; private set; } = [];

    public void OnGet()
    {
        Claims = User.Claims.Select(c => (c.Type, c.Value));
    }
}
