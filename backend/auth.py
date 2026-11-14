import hashlib
import hmac
import os
import re


def normalize_phone(phone: str) -> str:
    cleaned = re.sub(r"[\s\-().]", "", phone.strip())
    if not re.fullmatch(r"\+\d{8,15}", cleaned):
        raise ValueError("Enter your phone number with country code, e.g. +15551234567")
    return cleaned


def _scrypt(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    return salt.hex() + "$" + _scrypt(password, salt).hex()


def verify_password(password: str, stored: str) -> bool:
    salt_hex, hash_hex = stored.split("$")
    return hmac.compare_digest(_scrypt(password, bytes.fromhex(salt_hex)).hex(), hash_hex)