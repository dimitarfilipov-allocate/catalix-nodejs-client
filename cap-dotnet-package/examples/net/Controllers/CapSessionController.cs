using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using cap_libtester.Services;

namespace CAPNetClient.Controllers;

public class PassportRequest
{
    public string Token { get; set; } = string.Empty;
}

[ApiController]
[Route("api/[controller]")]
public class CapSessionController : ControllerBase
{
    private readonly ILogger<CapSessionController> _logger;
    private readonly IPassportGenerator _passportGenerator;

    public CapSessionController(ILogger<CapSessionController> logger, IPassportGenerator passportGenerator)
    {
        _logger = logger;
        _passportGenerator = passportGenerator;
    }

    [AllowAnonymous]
    [HttpPost("start-session")]
    [ProducesResponseType(typeof(string), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status500InternalServerError)]
    public IActionResult StartSession([FromBody] PassportRequest request)
    {
        try
        {
            if (request == null || string.IsNullOrWhiteSpace(request.Token))
            {
                _logger.LogWarning("StartSession called with invalid or missing token");
                return BadRequest("Token is required");
            }

            _logger.LogInformation("StartSession attempting to issue passport");

            var passport = _passportGenerator.CreatePassportFromIdToken(request.Token);

            _logger.LogInformation("StartSession completed successfully");
            return Ok(passport);
        }
        catch (ArgumentException ex)
        {
            _logger.LogWarning(ex, "StartSession failed due to invalid token format");
            return BadRequest("Invalid token format");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing StartSession request");
            return StatusCode(StatusCodes.Status500InternalServerError, "An error occurred while processing the request");
        }
    }
}
