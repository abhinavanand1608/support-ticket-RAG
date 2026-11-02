using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Identity;
using SupportTicketSystem.Models;  
using SupportTicketSystem.DTOs;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;

namespace SupportTicketSystem.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase {
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IConfiguration _configuration;

    public AuthController(UserManager<ApplicationUser> userManager, IConfiguration configuration) {
        _userManager = userManager;
        _configuration = configuration;
    }

    
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginDTO dto) {
        var user = await _userManager.FindByEmailAsync(dto.Email);
        
        if(user == null) {
            return Unauthorized("Invalid Credentials");
        } 

        if(!user.IsActive) {
            return Unauthorized("Account is deactivated");
        }

        var isPasswordValid = await _userManager.CheckPasswordAsync(user, dto.Password);
        if(!isPasswordValid) {
            return Unauthorized("Invalid Credentials");
        }

        var roles = await _userManager.GetRolesAsync(user);
        var claims = new List<Claim> {
            new Claim(ClaimTypes.Name, user.UserName),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.NameIdentifier, user.Id)
        };

        foreach(var role in roles) {
            claims.Add(new Claim(ClaimTypes.Role, role));
        }
        
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_configuration["Jwt:Key"]));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _configuration["Jwt:Issuer"],
            audience: _configuration["Jwt:Audience"],
            claims: claims,
            expires: DateTime.UtcNow.AddHours(1),
            signingCredentials: creds
        );

        var tokenString = new JwtSecurityTokenHandler().WriteToken(token);
        return Ok(new { token = tokenString });
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterDto dto) {
        var newUser = new ApplicationUser {
            UserName = dto.Email,
            Email = dto.Email
        };

        var role = string.IsNullOrEmpty(dto.Role) ? "User" : dto.Role;
        var validRoles = new[] {"User", "Agent", "Admin"};

        if(!validRoles.Contains(role)) {
            return BadRequest("Invalid Role Specified.");
        }

        var result = await _userManager.CreateAsync(newUser, dto.Password);

        if(!result.Succeeded) {
            return BadRequest(result.Errors);
        }

        await _userManager.AddToRoleAsync(newUser, role);

        return Ok("Registration Successful");
    }


}

