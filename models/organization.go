package models

import (
	"time"

	"gorm.io/gorm"
)

type Organization struct {
	ID          string         `gorm:"primaryKey"`
	Slug        string         `gorm:"uniqueIndex"`
	Name        string         `gorm:"not null"`
	Description string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}