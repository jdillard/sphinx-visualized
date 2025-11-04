"""
Example Python code for demonstration purposes.
"""

def hello_world():
    """Print a friendly greeting."""
    print("Hello, World!")
    return True

def calculate_sum(a, b):
    """
    Calculate the sum of two numbers.

    Args:
        a: First number
        b: Second number

    Returns:
        The sum of a and b
    """
    return a + b

if __name__ == "__main__":
    hello_world()
    result = calculate_sum(5, 3)
    print(f"The sum is: {result}")
