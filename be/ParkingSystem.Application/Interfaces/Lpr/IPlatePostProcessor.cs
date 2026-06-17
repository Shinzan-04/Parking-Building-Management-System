namespace ParkingSystem.Application.Interfaces.Lpr;

public interface IPlatePostProcessor
{
    string CleanAndFormatPlate(string rawText);
}
