// Vikunja is a to-do list application to facilitate your life.
// Copyright 2018-present Vikunja and contributors. All rights reserved.
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package migration

import (
	"testing"

	"code.vikunja.io/api/pkg/db"

	"github.com/stretchr/testify/require"
)

type tasksBefore20260906210000 struct {
	ID    int64  `xorm:"bigint autoincr not null unique pk"`
	Title string `xorm:"varchar(250) not null"`
}

func (tasksBefore20260906210000) TableName() string {
	return "tasks"
}

func TestAddTaskInheritProjectColor20260906210000(t *testing.T) {
	x, err := db.CreateTestEngine()
	require.NoError(t, err)

	table := tasksBefore20260906210000{}
	t.Cleanup(func() {
		require.NoError(t, x.DropTables(table))
	})
	require.NoError(t, x.DropTables(table))
	require.NoError(t, x.Sync2(table)) //nolint:forbidigo // test-local table

	_, err = x.Insert(&tasksBefore20260906210000{Title: "existing task"})
	require.NoError(t, err)

	require.NoError(t, addTaskInheritProjectColor20260906210000(x))

	tasks := []*tasks20260906210000{}
	require.NoError(t, x.Find(&tasks))
	require.Len(t, tasks, 1)
	require.False(t, tasks[0].InheritProjectColor)
}
