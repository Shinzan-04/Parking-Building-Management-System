using System.Linq.Expressions;

namespace ParkingSystem.Domain.Interfaces;

public interface IGenericRepository<T> where T : class
{
    Task<T?> GetByIdAsync(Guid id);
    Task<IEnumerable<T>> GetAllAsync(string? include = null);
    Task<IEnumerable<T>> FindAsync(Expression<Func<T, bool>> predicate, string? include = null);
    Task<T> AddAsync(T entity);
    Task UpdateAsync(T entity);
    Task DeleteAsync(T entity);
}
